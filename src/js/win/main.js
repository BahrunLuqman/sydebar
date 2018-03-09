'use strict';

sydebar.Win = {
	main: {},
	chat: {},
	chatRetainer: [],
	deviceManager: {},
	setAvatar: {},
	create: {}
};

window.addEventListener('load', function(e) {
	var renderWindowHeight = function(h) {
		if (process.platform === 'win32') {
			return h + 40;
		}
		return h;
	};

	var spawnChatWindow = function() {
		var chatWindow = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 470,
			minWidth: 470,
			height: renderWindowHeight(470),
			minHeight: renderWindowHeight(150),
			show: false,
			autoHideMenuBar: false,
			webPreferences: {
				nodeIntegration: false,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		chatWindow.loadURL(
			Path.join('file://' + __dirname, 'chat.html')
		);
		return chatWindow;
	};

	var mainRosterBuddy = React.createClass({
		displayName: 'mainRosterBuddy',
		getInitialState: function() {
			return {
				visible: true,
				statusText: 'Offline',
				avatar: 'xx'
			};
		},
		componentDidMount: function() {
			return true;
		},
		updateStatusText: function(seconds) {
			var statusText = 'Offline';
			if (this.props.status === 2) {
				statusText = 'Online';
			} else if (seconds > 0) {
				var ts = sydebar.Time.getTimestamp(
					Date.now() - (seconds * 1000)
				);
				statusText = `Last online: ${ts}`;
			}
			this.setState({
				statusText: statusText
			});
		},
		updateAvatar: function(avatar) {
			this.setState({
				avatar: avatar
			});
		},
		onClick: function() {
			if (sydebar.Me.connected) {
				sydebar.Win.create.chat(
					this.props.username, true, function() {}
				);
			}
		},
		onContextMenu: function(e) {
			e.preventDefault();
			var _t = this;
			(Remote.Menu.buildFromTemplate([
				{
					label: 'Open Chat',
					click: function() { _t.onClick(); }
				}, {
					label: 'View Devices',
					click: function() {
						sydebar.Win.create.deviceManager(_t.props.username);
					}
				}, {
					type: 'separator'
				}, {
					label: 'Remove Buddy',
					click: function() {
						sydebar.Diag.message.removeBuddyConfirm(function(response) {
							if (response === 0) {
								sydebar.XMPP.removeBuddy(_t.props.username);
							}
						});
					}
				}
			])).popup(Remote.getCurrentWindow());
		},
		render: function() {
			return React.createElement('div', {
				key: 0,
				className: 'mainRosterBuddy',
				'data-status': this.props.status,
				'data-visible': this.state.visible,
				title: 'Right click for buddy options',
				onClick: this.onClick,
				onContextMenu: this.onContextMenu
			}, [
				React.createElement('img', {
					key: 2,
					className: 'mainRosterBuddyAvatar',
					src: `../img/avatars/${this.state.avatar}.png`,
					draggable: false,
					alt: ''
				}),
				React.createElement('span', {
					key: 3,
					className: 'mainRosterBuddyUsername'
				}, this.props.username),
				React.createElement('span', {
					key: 4,
					className: 'mainRosterBuddyStatusText'
				}, this.state.statusText)
			]);
		}
	});

	var mainRoster = React.createClass({
		displayName: 'mainRoster',
		getInitialState: function() {
			return {
				buddies: {},
				isReconn: false,
				filter: ''
			};
		},
		componentDidMount: function() {
			return true;
		},
		componentWillUnmount: function() {
			delete this.renderedBuddies;
			return true;
		},
		renderedBuddies: {},
		buildRoster: function(rosterItems) {
			var newBuddies = {};
			var userBundles = sydebar.Me.settings.userBundles;
			var _t = this;
			rosterItems.forEach(function(item) {
				var status = 0;
				if (
					hasProperty(userBundles, item.jid.local) &&
					Object.keys(userBundles[item.jid.local]).length
				) {
					status = 1;
				} else {
					sydebar.XMPP.getDeviceList(item.jid.local);
				}
				var buddy = React.createElement(mainRosterBuddy, {
					key: item.jid.local,
					username: item.jid.local,
					subscription: item.subscription,
					status: status,
					ref: function(b) {
						_t.renderedBuddies[item.jid.local] = b;
					}
				});
				newBuddies[item.jid.local] = buddy;
				sydebar.XMPP.getAvatar(item.jid.local);
				sydebar.XMPP.queryLastSeen(item.jid.local);
			});
			this.setState({buddies: newBuddies});
		},
		updateBuddyStatus: function(username, status, notify) {
			var newBuddies = this.state.buddies;
			var _t = this;
			if (
				hasProperty(newBuddies, username) &&
				hasProperty(newBuddies[username], 'props') &&
				hasProperty(newBuddies[username].props, 'status') &&
				(newBuddies[username].props.status === status)
			) {
				return false;
			}
			newBuddies[username] = React.createElement(mainRosterBuddy, {
				key: username,
				username: username,
				subscription: '',
				status: status,
				ref: function(b) {
					_t.renderedBuddies[username] = b;
				}
			}, null);
			this.setState({buddies: newBuddies});
			this.renderedBuddies[username].updateStatusText(0);
			setTimeout(function() {
				if (sydebar.Me.connected) {
					sydebar.XMPP.queryLastSeen(username);
					sydebar.XMPP.getAvatar(username);
				}
			}, 2000);
			if (notify && (status === 2)) {
				sydebar.Notify.showNotification(
					`${username} is online`,
					`Click here to chat with them.`,
					function() {
						sydebar.Win.create.chat(username, true, function() {});
					}
				);
				sydebar.Notify.playSound('buddyOnline');
			}
			if (hasProperty(sydebar.Win.chat, username)) {
				sydebar.Win.chat[username].webContents.send(
					'chat.status', status
				);
			}
		},
		updateBuddyAvatar: function(username, avatar) {
			var _t = this;
			if (hasProperty(_t.renderedBuddies, username)) {
				_t.renderedBuddies[username].updateAvatar(avatar);
			}
			if (hasProperty(sydebar.Win.chat, username)) {
				sydebar.Win.chat[username].webContents.send(
					'chat.avatar', avatar
				);
			}
		},
		updateBuddyStatusText: function(username, seconds) {
			var _t = this;
			if (hasProperty(_t.renderedBuddies, username)) {
				_t.renderedBuddies[username].updateStatusText(seconds);
			}
		},
		getBuddyStatus: function(username) {
			return this.state.buddies[username].props.status;
		},
		getBuddyAvatar: function(username) {
			return this.renderedBuddies[username].state.avatar;
		},
		removeBuddy: function(username) {
			var _t = this;
			var newBuddies = this.state.buddies;
			if (!hasProperty(newBuddies, username)) {
				return false;
			}
			delete newBuddies[username];
			this.setState({buddies: newBuddies}, function() {
				delete _t.renderedBuddies[username];
				delete sydebar.Me.settings.userBundles[username];
			});
			if (hasProperty(sydebar.Win.chat, username)) {
				sydebar.Win.chat[username].webContents.send(
					'chat.status', 0
				);
			}
		},
		onChangeFilter: function(e) {
			var _t = this;
			var f = e.target.value.toLowerCase();
			_t.setState({filter: f}, function() {
				for (var b in _t.renderedBuddies) {
					if (hasProperty(_t.renderedBuddies, b)) {
						if (_t.renderedBuddies[b] === null) {
							delete _t.renderedBuddies[b];
						} else {
							_t.renderedBuddies[b].setState({
								visible: (_t.renderedBuddies[b].props
									.username.indexOf(f) === 0)
							});
						}
					}
				}
			});
		},
		render: function() {
			var buddiesArrays = [[], [], []];
			for (var p in this.state.buddies) {
				if (hasProperty(this.state.buddies, p)) {
					var b = this.state.buddies[p];
					buddiesArrays[
						Math.abs(b.props.status - 2)
					].push(b);
				}
			}
			for (var i = 0; i < 3; i += 1) {
				buddiesArrays[i].sort(function(a, b) {
					if (a.props.username < b.props.username) {
						return -1;
					}
					return +1;
				});
			}
			buddiesArrays = buddiesArrays[0].concat(
				buddiesArrays[1].concat(
					buddiesArrays[2]
				)
			);
			return React.createElement('div', {
				key: 0,
				className: 'mainRoster',
				onSubmit: this.onSubmit
			}, [
				React.createElement('div', {
					key: 1,
					className: 'mainRosterIsReconn',
					'data-visible': this.state.isReconn
				}, 'disconnected. reconnecting...'),
				React.createElement('input', {
					key: 2,
					type: 'text',
					className: 'mainRosterFilter',
					placeholder: 'Filter...',
					value: this.state.filter,
					onChange: this.onChangeFilter
				}),
				React.createElement('div', {
					key: 3,
					className: 'mainRosterIntro',
					'data-visible': !buddiesArrays.length
				}, React.createElement('h2', {
					key: 4
				}, 'Welcome.'),
				React.createElement('p', {
					key: 5
				}, ''))
			].concat(buddiesArrays));
		}
	});

	var mainLogin = React.createClass({
		displayName: 'mainLogin',
		getInitialState: function() {
			return {
				username: '',
				password: '',
				disabled: false,
				display: 'block',
				reconn: 5000,
				isReconn: false,
				rememberIsChecked: false
			};
		},
		componentDidMount: function() {
			var _t = this;
			var screenRes = (function() {
				var res = {
					width: 0,
					height: 0
				};
				var displays = Remote.screen.getAllDisplays();
				displays.forEach(function(display) {
					res.width += display.size.width;
					res.height += display.size.height;
				});
				return res;
			})();
			sydebar.Storage.getCommon(function(err, common) {
				if (
					common &&
					common.rememberedLogin.username.length &&
					common.rememberedLogin.password.length
				) {
					_t.setState({
						username: common.rememberedLogin.username,
						password: common.rememberedLogin.password,
						rememberIsChecked: true
					}, function() {
						_t.onSubmit();
					});
					document.getElementsByClassName(
						'mainLoginRememberCheckbox'
					)[0].checked = true;
				}
				if (
					common &&
					(screenRes.width > common.mainWindowBounds.x) &&
					(screenRes.height > common.mainWindowBounds.y)
				) {
					Remote.getCurrentWindow().setPosition(
						common.mainWindowBounds.x,
						common.mainWindowBounds.y
					);
					Remote.getCurrentWindow().setSize(
						common.mainWindowBounds.width,
						common.mainWindowBounds.height
					);
					Remote.getCurrentWindow().show();
				} else {
					Remote.getCurrentWindow().show();
				}
			});
			if (sydebar.Win.chatRetainer.length === 0) {
				sydebar.Win.chatRetainer.push(spawnChatWindow());
			}
			return true;
		},
		componentDidUpdate: function() {
			var _t = this;
			if (sydebar.Win.main.roster) {
				sydebar.Win.main.roster.setState({
					isReconn: _t.state.isReconn
				});
			}
		},
		onChangeUsername: function(e) {
			this.setState({username: e.target.value.toLowerCase()});
		},
		onChangePassword: function(e) {
			this.setState({password: e.target.value});
		},
		onSubmit: function(e) {
			var _t = this;
			if (this.validInputs()) {
				this.setState({disabled: true});
				sydebar.XMPP.connect(
					this.state.username, this.state.password,
					function(s) {
						if (s) {
							_t.onConnect();
						} else {
							_t.onDisconnect();
						}
					}
				);
			} else {
				sydebar.Diag.error.loginInvalid();
			}
			if (e) {
				e.preventDefault();
			}
			return false;
		},
		validInputs: function() {
			if (
				sydebar.Patterns.username.test(this.state.username) &&
				sydebar.Patterns.password.test(this.state.password)
			) {
				return true;
			}
			return false;
		},
		onConnect: function() {
			this.setState({
				display: 'none',
				isReconn: false,
				reconn: 5000
			});
			var rememberedLogin = {
				username: '',
				password: ''
			};
			if (this.state.rememberIsChecked) {
				rememberedLogin.username = this.state.username;
				rememberedLogin.password = this.state.password;
			}
			sydebar.Storage.updateCommon({
				rememberedLogin: rememberedLogin
			}, function() {});
			sydebar.Win.main.roster = ReactDOM.render(
				React.createElement(mainRoster, null),
				document.getElementById('renderB')
			);
			sydebar.Notify.playSound('loggedIn');
			IPCRenderer.send('app.updateMenuSettings', {
				notify: sydebar.Me.settings.notify,
				sounds: sydebar.Me.settings.sounds,
				typing: sydebar.Me.settings.typing
			});
			for (var username in sydebar.Win.chat) {
				if (hasProperty(sydebar.Win.chat, username)) {
					sydebar.Win.chat[username].webContents.send(
						'chat.connected', true
					);
				}
			}
			setTimeout(function() {
				if (
					(sydebar.Me.connected) &&
					(sydebar.Me.avatar === 'xx')
				) {
					sydebar.Win.create.setAvatar();
				}
			}, 3000);
		},
		onAuthFailed: function() {
			sydebar.Me = Object.assign({}, sydebar.EmptyMe);
			this.setState({
				disabled: false,
				display: 'block',
				isReconn: false,
				reconn: 5000
			});
			ReactDOM.unmountComponentAtNode(
				document.getElementById('renderB')
			);
			delete sydebar.Win.main.roster;
			sydebar.Diag.error.loginInvalid();
		},
		onDisconnect: function() {
			var _t = this;
			if (sydebar.Me.connected) {
				sydebar.Me.connected = false;
				_t.setState({
					isReconn: true
				});
				for (var username in sydebar.Win.chat) {
					if (hasProperty(sydebar.Win.chat, username)) {
						sydebar.Win.chat[username].webContents.send(
							'chat.connected', false
						);
					}
				}
			}
			console.info(
				'sydebar.Win:',
				'Reconnecting in ' + _t.state.reconn
			);
			setTimeout(function() {
				if (
					!sydebar.Me.connected &&
					_t.state.isReconn
				) {
					var incr = (function() {
						if (_t.state.reconn < 20000) {
							return 5000;
						}
						return 0;
					})();
					sydebar.XMPP.disconnect(false, function() {
						_t.onSubmit();
					});
					_t.setState({
						reconn: _t.state.reconn + incr,
						isReconn: true
					});
					return false;
				}
				_t.setState({
					reconn: 5000,
					isReconn: false
				});
			}, _t.state.reconn);
		},
		onLogOut: function() {
			sydebar.Me = Object.assign({}, sydebar.EmptyMe);
			this.setState({
				disabled: false,
				display: 'block',
				iReconn: false,
				reconn: 5000
			});
			for (var username in sydebar.Win.chat) {
				if (hasProperty(sydebar.Win.chat, username)) {
					sydebar.Win.chat[username].webContents.send(
						'chat.connected', false
					);
				}
			}
			if (!this.state.rememberIsChecked) {
				this.setState({
					password: ''
				});
			}
			ReactDOM.unmountComponentAtNode(
				document.getElementById('renderB')
			);
			delete sydebar.Win.main.roster;
		},
		onRememberCheckboxChange: function(e) {
			var bef = this.state.rememberIsChecked;
			var now = e.target.checked;
			this.setState({
				rememberIsChecked: now
			}, function() {
				if (!bef && now) {
					sydebar.Diag.message.rememberIsChecked();
				}
				if (bef && !now) {
					sydebar.Storage.updateCommon({
						rememberedLogin: {
							username: '',
							password: ''
						}
					}, function() {});
				}
			});
		},
		render: function() {
			return React.createElement('form', {
				className: 'mainLogin',
				onSubmit: this.onSubmit,
				style: {
					display: this.state.display
				}
			}, [
				React.createElement('img', {
					key: 0,
					src: '../img/logo/64x64.png',
					alt: 'sydebar',
					className: 'logo',
					draggable: 'false'
				}),
				React.createElement('input', {
					key: 1,
					type: 'text',
					placeholder: 'Username',
					value: this.state.username,
					onChange: this.onChangeUsername,
					autoFocus: true,
					disabled: this.state.disabled
				}),
				React.createElement('input', {
					key: 2,
					type: 'password',
					placeholder: 'Password',
					value: this.state.password,
					onChange: this.onChangePassword,
					disabled: this.state.disabled
				}),
				React.createElement('label', {
					key: 3,
					checked: this.state.rememberIsChecked,
					disabled: this.state.disabled,
					className: 'mainLoginRemember'
				}, [
				React.createElement('input', {
					key: 4,
					type: 'checkbox',
					onChange: this.onRememberCheckboxChange,
					className: 'mainLoginRememberCheckbox'
				}),
				React.createElement('span', {
					key: 5,
					className: 'mainLoginRememberText'
				}, 'Remember me')]),
				React.createElement('input', {
					key: 6,
					type: 'submit',
					value: 'Login',
					disabled: this.state.disabled
				}),
				React.createElement('br', {
					key: 7
				}),
				React.createElement('input', {
					key: 8,
					className: 'create',
					type: 'button',
					value: 'Create Account',
					onClick: function() {
						sydebar.Pinning.get(
							`https://${sydebar.Hostname}/create`,
							function(res, valid) {
								if (valid) {
									Remote.shell.openExternal(
										`https://${sydebar.Hostname}/create`
									);
								} else {
									sydebar.Diag.error.createAccount();
								}
							}
						);
					}
				}),
				React.createElement('span', {
					key: 9,
					className: 'version'
				}, sydebar.Version)
			]);
		}
	});

	sydebar.Win.create.updateDownloader = function() {
		var updateDownloader = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 330,
			height: renderWindowHeight(120),
			title: 'Downloading Update...',
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: true,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		updateDownloader.setMenu(null);
		updateDownloader.webContents.on('did-finish-load', function() {
			updateDownloader.show();
		});
		updateDownloader.loadURL(
			Path.join('file://' + __dirname, 'updateDownloader.html')
		);
	};

	sydebar.Win.create.chat = function(username, autoFocus, callback) {
		if (hasProperty(sydebar.Win.chat, username)) {
			sydebar.Win.chat[username].focus();
			return false;
		}
		if (sydebar.Win.chatRetainer.length === 0) {
			sydebar.Win.chatRetainer.push(spawnChatWindow());
		}
		sydebar.XMPP.getDeviceList(username);
		sydebar.Win.chat[username] = sydebar.Win.chatRetainer[0];
		sydebar.Win.chatRetainer.splice(0, 1);
		sydebar.Win.chat[username].on('closed', function() {
			delete sydebar.Win.chat[username];
		});
		sydebar.Win.chat[username].webContents.send('chat.init', {
			myUsername: sydebar.Me.username,
			theirUsername: username,
			status: sydebar.Win.main.roster.getBuddyStatus(username),
			avatar: sydebar.Win.main.roster.getBuddyAvatar(username),
			connected: sydebar.Me.connected,
			myDeviceName: sydebar.Me.settings.deviceName
		});
		sydebar.Win.chat[username].setTitle(username);
		if (autoFocus) {
			sydebar.Win.chat[username].show();
		} else {
			sydebar.Win.chat[username].showInactive();
		}
		if (sydebar.Win.chatRetainer.length === 0) {
			sydebar.Win.chatRetainer.push(spawnChatWindow());
		}
		callback();
	};

	sydebar.Win.create.addBuddy = function() {
		var addBuddyWindow = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 320,
			height: renderWindowHeight(160),
			title: 'Add Buddy',
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		addBuddyWindow.setMenu(null);
		addBuddyWindow.webContents.on('did-finish-load', function() {
			addBuddyWindow.show();
		});
		addBuddyWindow.loadURL(
			Path.join('file://' + __dirname, 'addBuddy.html')
		);
	};

	sydebar.Win.create.changePassword = function() {
		var changePasswordWindow = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 320,
			height: renderWindowHeight(190),
			title: 'Change Password',
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		changePasswordWindow.setMenu(null);
		changePasswordWindow.webContents.on('did-finish-load', function() {
			changePasswordWindow.show();
		});
		changePasswordWindow.loadURL(
			Path.join('file://' + __dirname, 'changePassword.html')
		);
	};

	sydebar.Win.create.addDevice = function() {
		var addDeviceWindow = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 400,
			height: renderWindowHeight(250),
			title: 'Add Device',
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		addDeviceWindow.setMenu(null);
		addDeviceWindow.webContents.on('did-finish-load', function() {
			addDeviceWindow.show();
		});
		addDeviceWindow.loadURL(
			Path.join('file://' + __dirname, 'addDevice.html')
		);
	};

	sydebar.Win.create.deviceManager = function(username) {
		if (hasProperty(sydebar.Win.deviceManager, username)) {
			sydebar.Win.deviceManager[username].focus();
			return false;
		}
		sydebar.Win.deviceManager[username] = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 470,
			height: renderWindowHeight(250),
			title: 'Manage Devices',
			resizable: false,
			minimizable: true,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		sydebar.Win.deviceManager[
			username
		].webContents.on('did-finish-load', function() {
			sydebar.Win.updateDeviceManager(username);
			sydebar.XMPP.getDeviceList(username);
			sydebar.Win.deviceManager[username].show();
		});
		sydebar.Win.deviceManager[username].on('closed', function() {
			delete sydebar.Win.deviceManager[username];
		});
		sydebar.Win.deviceManager[username].setMenu(null);
		sydebar.Win.deviceManager[username].loadURL(
			Path.join('file://' + __dirname, 'deviceManager.html')
		);
	};

	sydebar.Win.updateDeviceManager = function(username) {
		if (!hasProperty(sydebar.Win.deviceManager, username)) {
			return false;
		}
		var devices = [];
		var userBundles = sydebar.Me.settings.userBundles[username];
		for (var deviceId in userBundles) {
			if (hasProperty(userBundles, deviceId)) {
				var trusted = false;
				if (
					hasProperty(userBundles[deviceId], 'trusted') &&
					userBundles[deviceId].trusted
				) {
					trusted = true;
				}
				devices.push({
					deviceId: deviceId,
					deviceName: userBundles[deviceId].deviceName,
					deviceIcon: userBundles[deviceId].deviceIcon,
					deviceFingerprint: sydebar.OMEMO.deviceFingerprint(
						username, deviceId,
						userBundles[deviceId].deviceName,
						userBundles[deviceId].deviceIcon,
						userBundles[deviceId].identityKey
					),
					trusted: trusted
				});
			}
		}
		sydebar.Win.deviceManager[username].webContents.send(
			'deviceManager.update', {
				username: username,
				devices: devices,
				mine: (username === sydebar.Me.username),
				trustedOnly: (
					sydebar.Me.settings.trustedOnly.indexOf(username) >= 0
				)
			}
		);
	};

	sydebar.Win.create.setAvatar = function() {
		if (hasProperty(sydebar.Win.setAvatar, sydebar.Me.username)) {
			sydebar.Win.setAvatar[sydebar.Me.username].focus();
			return false;
		}
		sydebar.Win.setAvatar[sydebar.Me.username] = new Remote.BrowserWindow({
			icon: Path.join(
				Path.resolve(__dirname, '..'),
				'img/logo/64x64.png'
			),
			width: 470,
			height: renderWindowHeight(410),
			title: 'Set Avatar',
			resizable: false,
			minimizable: true,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false,
				preload: Path.join(
					Path.resolve(__dirname, '..'),
					'js/global.js'
				)
			}
		});
		sydebar.Win.setAvatar[
			sydebar.Me.username
		].webContents.on('did-finish-load', function() {
			sydebar.Win.setAvatar[sydebar.Me.username].send('setAvatar.init', {
				avatar: sydebar.Me.avatar,
				username: sydebar.Me.username
			});
			sydebar.Win.setAvatar[sydebar.Me.username].show();
		});
		sydebar.Win.setAvatar[sydebar.Me.username].on('closed', function() {
			delete sydebar.Win.setAvatar[sydebar.Me.username];
		});
		sydebar.Win.setAvatar[sydebar.Me.username].setMenu(null);
		sydebar.Win.setAvatar[sydebar.Me.username].loadURL(
			Path.join('file://' + __dirname, 'setAvatar.html')
		);
	};

	sydebar.Win.main.login = ReactDOM.render(
		React.createElement(mainLogin, null),
		document.getElementById('renderA')
	);

	sydebar.Win.main.beforeQuit = function() {
		var position = Remote.getCurrentWindow().getPosition();
		var size = Remote.getCurrentWindow().getSize();
		sydebar.Storage.updateCommon({
			mainWindowBounds: {
				x: position[0],
				y: position[1],
				width: size[0],
				height: size[1]
			}
		}, function() {
			for (var username in sydebar.Win.chat) {
				if (hasProperty(sydebar.Win.chat, username)) {
					sydebar.Win.chat[username].destroy();
					delete sydebar.Win.chat[username];
				}
			}
			if (sydebar.Me.connected) {
				sydebar.XMPP.disconnect(false, function() {
					IPCRenderer.sendSync('app.quit');
				});
				setTimeout(function() {
					sydebar.Me.connected = false;
					sydebar.Storage.updateUser(
						sydebar.Me.username,
						sydebar.Me.settings,
						function() {
							IPCRenderer.sendSync('app.quit');
						}
					);
				}, 5000);
			} else {
				IPCRenderer.sendSync('app.quit');
			}
		});
	};

	IPCRenderer.on('aboutBox.create', function(e) {
		sydebar.Diag.message.about();
	});

	IPCRenderer.on('addDevice.addDevice', function(e, name, icon) {
		sydebar.OMEMO.onAddDevice(name, icon);
	});

	IPCRenderer.on('addBuddy.create', function(e) {
		if (sydebar.Me.connected) {
			sydebar.Win.create.addBuddy();
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('addBuddy.sendRequest', function(e, username) {
		if (sydebar.Me.connected) {
			if (username === sydebar.Me.username) {
				sydebar.Diag.error.addBuddySelf();
			} else if (sydebar.OMEMO.jidHasUsername(username).valid) {
				sydebar.Diag.error.addBuddyAdded();
			} else {
				sydebar.XMPP.sendBuddyRequest(username);
				sydebar.Diag.message.addBuddySuccess();
			}
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('changePassword.changePassword', function(e, password) {
		if (sydebar.Me.connected) {
			sydebar.XMPP.changePassword(sydebar.Me.username, password);
			if (sydebar.Win.main.login.state.rememberIsChecked) {
				sydebar.Storage.updateCommon({
					rememberedLogin: {
						username: '',
						password: ''
					}
				}, function() {});
			}
			sydebar.Diag.message.changePasswordSuccess();
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('changePassword.create', function(e) {
		if (sydebar.Me.connected) {
			sydebar.Win.create.changePassword();
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('chat.myChatState', function(e, to, chatState) {
		if (sydebar.Me.settings.typing) {
			sydebar.XMPP.sendChatState(to, chatState);
		}
	});

	IPCRenderer.on('chat.openDialog', function(e, to) {
		sydebar.Directories.openDialog(
			sydebar.Win.chat[to],
			sydebar.Me.settings.directories.fileSelect,
			function(paths) {
				if (!paths || !paths.length) { return false; }
				sydebar.Me.settings.directories.fileSelect =
					Path.dirname(paths[0]) + Path.sep;
				sydebar.Win.chat[to].webContents.send(
					'chat.openDialog', paths
				);
			}
		);
	});

	IPCRenderer.on('chat.saveDialog', function(e, to, name, url) {
		sydebar.Directories.saveDialog(
			sydebar.Win.chat[to],
			sydebar.Me.settings.directories.fileSave,
			name, function(path) {
				if (!path) { return false; }
				sydebar.Me.settings.directories.fileSave =
					Path.dirname(path) + Path.sep;
				sydebar.Win.chat[to].webContents.send(
					'chat.saveDialog', path, url
				);
			}
		);
	});

	IPCRenderer.on('chat.sendMessage', function(e, to, message) {
		sydebar.OMEMO.sendMessage(to, message);
	});

	IPCRenderer.on('deviceManager.create', function(e, username) {
		if (sydebar.Me.connected) {
			if (!username || !username.length) {
				username = sydebar.Me.username;
			}
			sydebar.Win.create.deviceManager(username);
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('deviceManager.removeDevice', function(e, deviceId) {
		sydebar.OMEMO.removeDevice(deviceId);
	});

	IPCRenderer.on('deviceManager.setTrusted', function(
		e, username, deviceId, trusted
	) {
		sydebar.Me.settings.userBundles[username][deviceId].trusted = trusted;
	});

	IPCRenderer.on('deviceManager.setTrustedOnly', function(e, username, trusted) {
		var trustedOnly = sydebar.Me.settings.trustedOnly;
		var indexOf = trustedOnly.indexOf(username);
		if (trusted) {
			if (indexOf < 0) {
				trustedOnly.push(username);
			}
		} else {
			if (indexOf >= 0) {
				trustedOnly.splice(indexOf, 1);
			}
		}
	});

	IPCRenderer.on('main.beforeQuit', function(e) {
		sydebar.Win.main.beforeQuit();
	});

	IPCRenderer.on('main.checkForUpdates', function(e) {
		sydebar.Update.check(true, function() {
			sydebar.Diag.message.isLatest(
				sydebar.Version
			);
		});
	});

	IPCRenderer.on('main.deleteAccount', function(e) {
		if (!sydebar.Me.connected) {
			sydebar.Diag.error.offline();
			return false;
		}
		sydebar.Diag.message.deleteAccount(
			sydebar.Me.username, function(response) {
				if (response === 1) {
					Remote.shell.openExternal(
						`https://${sydebar.Hostname}/help.html#deleteAccount`
					);
				}
				if (response === 2) {
					if (sydebar.Win.main.login.state.rememberIsChecked) {
						sydebar.Storage.updateCommon({
							rememberedLogin: {
								username: '',
								password: ''
							}
						}, function() {});
					}
					sydebar.XMPP.deleteAccount(
						sydebar.Me.username
					);
				}
			}
		);
	});

	IPCRenderer.on('main.logOut', function(e) {
		if (sydebar.Me.connected) {
			sydebar.XMPP.disconnect(false, function() {
				sydebar.Win.main.login.onLogOut();
			});
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('main.onSuspend', function(e) {
		if (sydebar.Me.connected) {
			sydebar.XMPP.disconnect(true);
		}
	});

	IPCRenderer.on('main.updateNotifySetting', function(e, notify) {
		if (sydebar.Me.connected) {
			sydebar.Me.settings.notify = notify;
			IPCRenderer.send('app.updateMenuSettings', {
				notify: sydebar.Me.settings.notify,
				sounds: sydebar.Me.settings.sounds,
				typing: sydebar.Me.settings.typing
			});
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('main.updateSoundsSetting', function(e, sounds) {
		if (sydebar.Me.connected) {
			sydebar.Me.settings.sounds = sounds;
			IPCRenderer.send('app.updateMenuSettings', {
				notify: sydebar.Me.settings.notify,
				sounds: sydebar.Me.settings.sounds,
				typing: sydebar.Me.settings.typing
			});
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('main.updateTypingSetting', function(e, typing) {
		if (sydebar.Me.connected) {
			sydebar.Me.settings.typing = typing;
			IPCRenderer.send('app.updateMenuSettings', {
				notify: sydebar.Me.settings.notify,
				sounds: sydebar.Me.settings.sounds,
				typing: sydebar.Me.settings.typing
			});
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('setAvatar.create', function() {
		if (sydebar.Me.connected) {
			sydebar.Win.create.setAvatar();
		} else {
			sydebar.Diag.error.offline();
		}
	});

	IPCRenderer.on('setAvatar.setAvatar', function(e, avatar) {
		sydebar.XMPP.setAvatar(avatar);
	});

	(function() {
		// Check for updates on application start.
		sydebar.Update.check(true, () => {});
		// Check for updates every 24 hours.
		setInterval(() => {
			sydebar.Update.check(false, () => {});
		}, (1000 * 3600 * 24));
	})();

});

