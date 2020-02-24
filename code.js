const vscode = require('vscode');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let disposable = vscode.commands.registerCommand('paste.upload', async function () {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showErrorMessage("You need open editor to upload paste.");
			return;
		}
		var expiresat = vscode.workspace.getConfiguration().get('paste.api.expire');
		var expires = "";
		switch (expiresat) {
			case "Never":
				expires = "N";
				break;
			case "10 minutes":
				expires = "10M";
				break;
			case "1 hour":
				expires = "1H";
				break;
			case "1 day":
				expires = "1D";
				break;
			case "1 week":
				expires = "1W";
				break;
			case "1 month":
				expires = "1M";
				break;
			case "6 months":
				expires = "6M";
				break;
			case "1 year":
				expires = "1Y";
				break;
			case "Check every time":
				await vscode.window.showQuickPick(["Never", "10 minutes", "1 hour", "1 day", "1 week", "1 month", "6 months", "1 year"]).then(result => {
					switch (result) {
						case "Never":
							expires = "N";
							break;
						case "10 minutes":
							expires = "10M";
							break;
						case "1 hour":
							expires = "1H";
							break;
						case "1 day":
							expires = "1D";
							break;
						case "1 week":
							expires = "1W";
							break;
						case "1 month":
							expires = "1M";
							break;
						case "6 months":
							expires = "6M";
							break;
						case "1 year":
							expires = "1Y";
							break;
					}
				})
				break;
		}
		if (expires == "") {
			return;
		}
		var apikey = vscode.workspace.getConfiguration().get('paste.api.key');
		var data = { "api_dev_key": apikey, "api_paste_code": vscode.window.activeTextEditor.document.getText(), "api_paste_expire_date": expires, "api_paste_name": vscode.window.activeTextEditor.document.fileName }; // POSTメソッドで送信するデータ
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Uploading Paste...",
			cancellable: false,

		}, (progress) => {
			var p = new Promise(resolve => {
				var xmlHttpRequest = new XMLHttpRequest();
				xmlHttpRequest.open('POST', 'https://paste.mcua.net/pbapi/paste');
				xmlHttpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				xmlHttpRequest.onreadystatechange = async function () {
					var READYSTATE_COMPLETED = 4;
					var HTTP_STATUS_OK = 200;
					if (this.readyState == READYSTATE_COMPLETED &&
						this.status == 400) {
						vscode.window.showErrorMessage("Invalid response from API.\nPlease check API Key in settings.\nResponse message: " + this.responseText);
						resolve();
					}
					if (this.readyState == READYSTATE_COMPLETED
						&& this.status == HTTP_STATUS_OK) {
						progress.report({ message: "Uploaded!", increment: 100 });
						vscode.window.showInformationMessage(this.responseText, "Open in browser", "Copy to clipboard")
							.then((select) => {
								if (select == "Open in browser") {
									vscode.env.openExternal(this.responseText);
								}
								if (select == "Copy to clipboard") {
									vscode.env.clipboard.writeText(this.responseText);
								}
							});
						resolve();
					}
				}
				xmlHttpRequest.send(EncodeHTMLForm(data));
			});
			return p;
		});

	});

	let importcommand = vscode.commands.registerCommand('paste.import', async function () {
		await vscode.window.showQuickPick(["From My Pastes (Requires API Key)", "From URL"]).then(result => {
			if (result == undefined) {
				return;
			}
			if (result == "From My Pastes (Requires API Key)") {
				var apikey = vscode.workspace.getConfiguration().get('paste.api.key');
				var language = vscode.workspace.getConfiguration().get('paste.defaultlanguage');
				var data = { "apikey": apikey };
				var xmlHttpRequest = new XMLHttpRequest();
				xmlHttpRequest.onreadystatechange = async function () {
					var READYSTATE_COMPLETED = 4;
					if (this.readyState == READYSTATE_COMPLETED) {
						var pastes = JSON.parse(this.responseText);
						if (!pastes["result"]) {
							vscode.window.showErrorMessage("Invalid response.\nPlease check API Key in settings.\nResponse message: " + pastes["reason"]);
							return;
						}
						var viewlist = [];
						var urllist = [];
						for (var paste in pastes["0"]) {
							viewlist.push(pastes["0"][paste]["name"] + "(" + pastes["0"][paste]["id"] + ")");
							urllist.push("https://paste.mcua.net/raw/" + pastes["0"][paste]["id"]);
						}
						await vscode.window.showQuickPick(viewlist).then(result => {
							if (result == undefined) {
								return;
							}
							vscode.window.withProgress({
								location: vscode.ProgressLocation.Notification,
								title: "Downloading Paste...",
								cancellable: false,
							}, () => {
								var p = new Promise(resolve => {
									var getreq = new XMLHttpRequest();
									getreq.open("GET", urllist[viewlist.indexOf(result)]);
									getreq.send(null);
									getreq.onreadystatechange = async function () {
										var READYSTATE_COMPLETED = 4;
										var HTTP_STATUS_OK = 200;

										if (this.readyState == READYSTATE_COMPLETED
											&& this.status == HTTP_STATUS_OK) {
											openInUntitled(this.responseText, language);
											resolve();
											return;
										}
									}
									resolve();
								})
								return p;
							});
						})
					}

				}
				xmlHttpRequest.open('POST', 'https://paste.mcua.net/api/list');
				xmlHttpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				xmlHttpRequest.send(EncodeHTMLForm(data));
			}
			if (result == "From URL") {
				vscode.window.showInputBox("Paste URL").then(url => {
					if (!url.startsWith("https://paste.mcua.net/raw/")) {
						vscode.window.showErrorMessage("Invalid paste URL.\nExample: https://paste.mcua.net/raw/foobar");
						return;
					}
					vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: "Downloading Paste...",
						cancellable: false,
					}, () => {
						var p = new Promise(resolve => {
							var getreq = new XMLHttpRequest();
							getreq.open("GET", url);
							getreq.send(null);
							getreq.onreadystatechange = async function () {
								var READYSTATE_COMPLETED = 4;
								var HTTP_STATUS_OK = 200;

								if (this.readyState == READYSTATE_COMPLETED
									&& this.status == HTTP_STATUS_OK) {
									openInUntitled(this.responseText);
									resolve();
								}
								resolve();
							}
						})
						return p;
					})

				})

			}
		})

	});

	let editcommand = vscode.commands.registerCommand('paste.edit', async function () {
		var apikey = vscode.workspace.getConfiguration().get('paste.api.key');
		var data = { "apikey": apikey };
		var xmlHttpRequest = new XMLHttpRequest();
		xmlHttpRequest.onreadystatechange = async function () {
			var READYSTATE_COMPLETED = 4;
			if (this.readyState == READYSTATE_COMPLETED) {
				var pastes = JSON.parse(this.responseText);
				if (!pastes["result"]) {
					vscode.window.showErrorMessage("Invalid response.\nPlease check API Key in settings.\nResponse message: " + pastes["reason"]);
					return;
				}
				var viewlist = [];
				var idlist = [];
				for (var paste in pastes["0"]) {
					viewlist.push(pastes["0"][paste]["name"] + "(" + pastes["0"][paste]["id"] + ")");
					idlist.push(pastes["0"][paste]["id"]);
				}
				await vscode.window.showQuickPick(viewlist).then(result => {
					if (result == undefined) {
						return;
					}
					var data = { "apikey": apikey, "id": idlist[viewlist.indexOf(result)], "paste": vscode.window.activeTextEditor.document.getText() }; // POSTメソッドで送信するデータ
					vscode.window.showInformationMessage("Uploading paste. Please wait...")
					vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: "Uploading Paste...",
						cancellable: false,
					}, () => {
						var p = new Promise(resolve => {
							var getreq = new XMLHttpRequest();
							getreq.open('POST', 'https://paste.mcua.net/api/update');
							getreq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
							getreq.send(EncodeHTMLForm(data));
							getreq.onreadystatechange = async function () {
								var READYSTATE_COMPLETED = 4;
								var HTTP_STATUS_OK = 200;
								if (this.readyState == READYSTATE_COMPLETED
									&& this.status == HTTP_STATUS_OK) {
									var response = JSON.parse(this.responseText);
									if (!response["result"]) {
										vscode.window.showErrorMessage("Invalid response.\nPlease check API Key in settings.\nResponse message: " + response["reason"]);
										resolve();
									}
									vscode.window.showInformationMessage("Edited!");
									resolve();
								}
							}
						})
						return p;
					})

				})
			}

		}
		xmlHttpRequest.open('POST', 'https://paste.mcua.net/api/list');
		xmlHttpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xmlHttpRequest.send(EncodeHTMLForm(data));
	});


	context.subscriptions.push(disposable);
	context.subscriptions.push(importcommand);
	context.subscriptions.push(editcommand);
}
exports.activate = activate;

function deactivate() {
}

async function openInUntitled(content, language) {
	const document = await vscode.workspace.openTextDocument({
		language,
		content,
	});
	vscode.window.showTextDocument(document);
}



module.exports = {
	activate,
	deactivate
}

function EncodeHTMLForm(data) {
	var params = [];

	for (var name in data) {
		var value = data[name];
		var param = encodeURIComponent(name) + '=' + encodeURIComponent(value);

		params.push(param);
	}

	return params.join('&').replace(/%20/g, '+');
}
