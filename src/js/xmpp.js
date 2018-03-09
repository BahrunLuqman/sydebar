'use strict';
sydebar.XMPP = {};
var client = {};

(function() {
	var handler = {};
	var callbacks = {
		disconnected: {
			armed: false,
			payload: function() {}
		}
	};

	setInterval(function() {
		if (sydebar.Me.connected) {
			client.sendPresence();
		}
	}, 60000);

	handler.raw = function(raw) {
		XML2JS.parseString(raw, function(err, res) {
			var fromUser = sydebar.Me.username;
			var data = [];
			var deviceIds = [];
			var deviceId = '';
			if (err) { return false; }
			if (
				hasProperty(res, 'iq') &&
				hasProperty(res.iq, 'query') &&
				hasProperty(res.iq, '$') &&
				hasProperty(res.iq.$, 'from') &&
				hasProperty(res.iq.query, '0') &&
				hasProperty(res.iq.query[0], '$') &&
				hasProperty(res.iq.query[0].$, 'seconds') &&
				((typeof res.iq.query[0].$.seconds) === 'string') &&
				(/^[0-9]{1,10}$/).test(res.iq.query[0].$.seconds) &&
				sydebar.OMEMO.jidHasUsername(
					res.iq.$.from
				).valid
			) {
				var seconds = parseInt(
					res.iq.query[0].$.seconds, 10
				);
				fromUser = sydebar.OMEMO.jidHasUsername(
					res.iq.$.from
				).username;
				handler.last(fromUser, seconds);
				return false;
			}
			if (
				hasProperty(res, 'message') &&
				hasProperty(res.message, 'event')
			) {
				data = res.message.event;
				if (
					hasProperty(res.message, '$') &&
					hasProperty(res.message.$, 'from') &&
					sydebar.OMEMO.jidHasUsername(
						res.message.$.from
					).valid
				) {
					fromUser = sydebar.OMEMO.jidHasUsername(
						res.message.$.from
					).username;
				}
				handler.pubsub(fromUser, data);
			} else if (
				hasProperty(res, 'iq') &&
				hasProperty(res.iq, 'pubsub')
			) {
				data = res.iq.pubsub;
				if (
					hasProperty(res.iq, '$') &&
					hasProperty(res.iq.$, 'from') &&
					sydebar.OMEMO.jidHasUsername(res.iq.$.from).valid
				) {
					fromUser = sydebar.OMEMO.jidHasUsername(
						res.iq.$.from
					).username;
				}
				handler.pubsub(fromUser, data);
			} else if (
				hasProperty(res, 'iq') &&
				hasProperty(res.iq.$, 'type') &&
				(res.iq.$.type === 'error')
			) {
				deviceIds = sydebar.Me.settings.deviceIds;
				deviceId = sydebar.Me.settings.deviceId;
				if (deviceIds.indexOf(deviceId) < 0) {
					sydebar.XMPP.sendDeviceList(
						deviceIds.concat([deviceId])
					);
					sydebar.XMPP.sendBundle();
				}
				return false;
			}
		});
	};

	handler.pubsub = function(fromUser, data) {
		if (
			hasProperty(data, '0') &&
			hasProperty(data[0], 'items') &&
			hasProperty(data[0].items, '0') &&
			hasProperty(data[0].items[0], '$') &&
			hasProperty(data[0].items[0].$, 'node')
		) {
			data = data[0].items[0];
			if ((/^urn:xmpp:avatar:data$/).test(data.$.node)) {
				handler.avatar(fromUser, data);
			} else if ((/^urn:xmpp:omemo:0:devicelist$/).test(data.$.node)) {
				handler.devicelist(fromUser, data);
			} else if (sydebar.OMEMO.nodeHasDeviceId(data.$.node).valid) {
				handler.bundle(fromUser, data);
			}
			return false;
		}
	};

	handler.avatar = function(fromUser, data) {
		if (
			hasProperty(data, 'item') &&
			hasProperty(data.item, '0') &&
			hasProperty(data.item[0], '$') &&
			hasProperty(data.item[0].$, 'id') &&
			sydebar.Patterns.avatar.test(data.item[0].$.id)
		) {
			if (fromUser === sydebar.Me.username) {
				sydebar.Me.avatar = data.item[0].$.id;
			} else {
				sydebar.Win.main.roster.updateBuddyAvatar(
					fromUser, data.item[0].$.id
				);
			}
		}
	};

	handler.last = function(fromUser, seconds) {
		sydebar.Win.main.roster.updateBuddyStatusText(
			fromUser, seconds
		);
	};

	handler.devicelist = function(fromUser, data) {
		var deviceIds = [];
		if (
			hasProperty(data, 'item') &&
			hasProperty(data.item, '0') &&
			hasProperty(data.item[0], 'list') &&
			hasProperty(data.item[0].list, '0')
		) {
			if (!Array.isArray(data.item[0].list[0].device)) {
				sydebar.OMEMO.onGetDeviceList(fromUser, []);
				return false;
			}
			data = data.item[0].list[0].device;
			for (var i = 0; i < data.length; i += 1) {
				if (
					hasProperty(data[i], '$') &&
					hasProperty(data[i].$, 'id') &&
					sydebar.Patterns.hex32.test(data[i].$.id)
				) {
					deviceIds.push(data[i].$.id);
				}
			}
			sydebar.OMEMO.onGetDeviceList(fromUser, deviceIds);
		} else if (fromUser === sydebar.Me.username) {
			sydebar.XMPP.sendDeviceList(
				sydebar.Me.settings.deviceIds.concat(
					[sydebar.Me.settings.deviceId]
				)
			);
			sydebar.XMPP.sendBundle();
		}
	};

	handler.bundle = function(fromUser, data) {
		var preKeys = [];
		var deviceId = sydebar.OMEMO.nodeHasDeviceId(
			data.$.node
		).deviceId;
		if (!sydebar.OMEMO.isProperBundle(data)) {
			return false;
		}
		data = data.item[0].bundle[0];
		preKeys = sydebar.OMEMO.extractPreKeys(
			data.prekeys[0].preKeyPublic
		);
		sydebar.OMEMO.onGetBundle(fromUser, deviceId, {
			identityKey: data.identityKey[0]._,
			deviceName: data.identityKey[0].$.deviceName,
			deviceIcon: data.identityKey[0].$.deviceIcon,
			signedPreKey: data.signedPreKeyPublic[0]._,
			signedPreKeyId: data.signedPreKeyPublic[0].$.signedPreKeyId,
			signedPreKeySignature: data.signedPreKeySignature[0],
			preKeys: preKeys
		});
	};

	handler.error = function(error, username, password, callback) {
		console.info('sydebar.XMPP ERROR', error);
		client.disconnect();
		callback(false);
	};

	handler.connected = function(username, data, callback) {
		console.info('sydebar.XMPP CONNECTED', data.local);
		sydebar.Me.connected = true;
		sydebar.XMPP.getDeviceList(username);
		sydebar.XMPP.getAvatar(username);
		client.enableKeepAlive();
		client.getRoster();
		client.sendPresence();
		client.connectDate = Math.floor(Date.now() / 1000);
		callback(true);
	};

	handler.authFailed = function() {
		sydebar.Win.main.login.onAuthFailed();
	};

	handler.disconnected = function(callback) {
		var chooseCallback = function() {
			if (callbacks.disconnected.armed) {
				callbacks.disconnected.armed = false;
				callbacks.disconnected.payload();
			} else { callback(false); }
		};
		if (sydebar.Me.username.length) {
			sydebar.Storage.updateUser(
				sydebar.Me.username,
				sydebar.Me.settings,
				function() { chooseCallback(); }
			);
		} else { chooseCallback(); }
	};

	handler.encrypted = function(encrypted) {
		sydebar.OMEMO.receiveMessage(encrypted, 5, function(message) {
			if (!message.valid) {
				console.info(
					'sydebar.XMPP',
					'Indecipherable message from ' + encrypted.from
				);
				sydebar.OMEMO.rebuildDeviceSession(encrypted.from, encrypted.sid);
				sydebar.XMPP.deliverMessage(
					encrypted.from, {
						plaintext: ('This message could not be decrypted. ' +
							'You may want to ask your buddy to send it again.'),
						valid: message.valid,
						stamp: encrypted.stamp,
						offline: encrypted.offline,
						deviceName: ''
					}
				);
			} else {
				var deviceName = sydebar.Me.settings.userBundles[
					encrypted.from][encrypted.sid
				].deviceName;
				sydebar.XMPP.deliverMessage(
					encrypted.from, {
						plaintext: message.plaintext,
						valid: message.valid,
						stamp: encrypted.stamp,
						offline: encrypted.offline,
						deviceName: deviceName
					}
				);
			}
		});
	};

	handler.chatState = function(message) {
		var username = sydebar.OMEMO.jidHasUsername(message.from.bare);
		if (
			(/^(composing)|(paused)$/).test(message.chatState) &&
			username.valid &&
			hasProperty(sydebar.Win.chat, username.username)
		) {
			sydebar.Win.chat[username.username].webContents.send(
				'chat.theirChatState', message.chatState
			);
		}
	};

	handler.availability = function(data) {
		var local = sydebar.OMEMO.jidHasUsername(data.from.bare);
		var s = 2;
		if (
			!local.valid ||
			(local.username === sydebar.Me.username)
		) {
			return false;
		}
		if (data.type === 'unavailable') {
			s = 0;
		}
		if (
			(s === 0) &&
			hasProperty(sydebar.Me.settings.userBundles, local.username) &&
			Object.keys(sydebar.Me.settings.userBundles[local.username]).length
		) {
			s = 1;
		}
		if (s !== sydebar.Win.main.roster.getBuddyStatus(local.username)) {
			client.subscribeToNode(
				`${local.username}@${sydebar.Hostname}`,
				'urn:xmpp:omemo:0:devicelist'
			);
			sydebar.XMPP.getDeviceList(local.username);
			sydebar.Win.main.roster.updateBuddyStatus(
				local.username, s, (
					Math.floor(Date.now() / 1000) > (client.connectDate + 10)
				)
			);
		}
	};

	handler.roster = function(roster) {
		if (hasProperty(roster, 'items')) {
			sydebar.Win.main.roster.buildRoster(roster.items);
			for (var i = 0; i < roster.items.length; i += 1) {
				client.subscribeToNode(
					roster.items[i].jid.bare, 'urn:xmpp:omemo:0:devicelist'
				);
			}
		}
	};

	handler.subscribe = function(data) {
		var username = sydebar.OMEMO.jidHasUsername(data.from.bare);
		if (username.valid) {
			client.acceptSubscription(data.from.bare);
			sydebar.XMPP.sendBuddyRequest(username.username);
			return false;
		}
		if (!sydebar.Patterns.username.test(data.from.local)) {
			return false;
		}
		sydebar.Diag.message.addBuddyRequest(
			data.from.local, function(response) {
				if (response === 0) {
					sydebar.Win.main.roster.updateBuddyStatus(
						data.from.local, 0, false
					);
					client.acceptSubscription(data.from.bare);
					sydebar.XMPP.sendBuddyRequest(data.from.local);
					setTimeout(function() {
						client.sendPresence();
					}, 5000);
				}
				if (response === 1) {
					client.denySubscription(data.from.bare);
				}
			}
		);
	};

	handler.unsubscribed = function(data) {
		var username = sydebar.OMEMO.jidHasUsername(data.from.bare);
		if (username.valid) {
			sydebar.Diag.message.buddyUnsubscribed(username.username);
			sydebar.XMPP.removeBuddy(username.username);
			client.sendPresence();
		}
	};

	var initConnectionAndHandlers = function(username, password, callback) {
		client = XMPP.createClient({
			jid: `username@${sydebar.Hostname}`,
			server: sydebar.Hostname,
			credentials: {
				username: username,
				password: password,
				host: sydebar.Hostname,
				serviceType: 'XMPP',
				serviceName: sydebar.Hostname,
				realm: sydebar.Hostname
			},
			transport: 'websocket',
			timeout: 10000,
			wsURL: `wss://${sydebar.Hostname}:443/socket`,
			useStreamManagement: false
		});
		client.use(sydebar.OMEMO.plugins.deviceList);
		client.use(sydebar.OMEMO.plugins.bundle);
		client.use(sydebar.OMEMO.plugins.last);
		client.use(sydebar.OMEMO.plugins.encrypted);
		client.on('raw:incoming', function(raw) {
			handler.raw(raw);
		});
		client.on('raw:outgoing', function(raw) {
		});
		client.on('session:error', function(error) {
			handler.error(
				error, username, password, callback
			);
		});
		client.on('session:started', function(data) {
			handler.connected(username, data, callback);
		});
		client.on('auth:failed', function(data) {
			handler.authFailed();
		});
		client.on('disconnected', function() {
			handler.disconnected(callback);
		});
		client.on('message', function(message) {
		});
		client.on('chat:state', function(message) {
			handler.chatState(message);
		});
		client.on('encrypted', function(encrypted) {
			handler.encrypted(encrypted);
		});
		client.on('available', function(data) {
			handler.availability(data);
		});
		client.on('unavailable', function(data) {
			handler.availability(data);
		});
		client.on('roster:update', function(stanza) {
		});
		client.on('subscribe', function(data) {
			handler.subscribe(data);
		});
		client.on('unsubscribed', function(data) {
			handler.unsubscribed(data);
		});
		client.on('stanza', function(stanza) {
			if (
				(stanza.type === 'result') &&
				(hasProperty(stanza, 'roster'))
			) {
				handler.roster(stanza.roster);
			}
		});
		client.connect();
	};

	sydebar.XMPP.connect = function(username, password, callback) {
		console.info('sydebar.XMPP', 'Connecting as ' + username);
		if (
			hasProperty(client, 'jid') &&
			hasProperty(client.jid, 'local') &&
			(client.jid.local === username) &&
			(sydebar.Me.username === username)
		) {
			client.connect();
			return false;
		}
		sydebar.Pinning.get(
			`https://${sydebar.Hostname}/socket`,
			function(res, valid) {
				if (!valid) {
					handler.authFailed();
					return false;
				}
				if (sydebar.Me.username === username) {
					initConnectionAndHandlers(username, password, callback);
				} else {
					sydebar.Me.username = username;
					sydebar.OMEMO.setup(function() {
						initConnectionAndHandlers(username, password, callback);
					});
				}
			}
		);
	};

	sydebar.XMPP.sendMessage = function(to, items) {
		client.sendMessage({
			type: 'chat',
			to: `${to}@${sydebar.Hostname}`,
			encrypted: { encryptedItems: items },
			body: ''
		});
	};

	sydebar.XMPP.sendChatState = function(to, chatState) {
		client.sendMessage({
			type: 'chat',
			to: `${to}@${sydebar.Hostname}`,
			chatState: chatState
		});
	};

	sydebar.XMPP.sendBuddyRequest = function(username) {
		sydebar.Win.main.roster.updateBuddyStatus(
			username, 0, false
		);
		client.subscribe(`${username}@${sydebar.Hostname}`);
	};

	sydebar.XMPP.removeBuddy = function(username) {
		client.removeRosterItem(
			`${username}@${sydebar.Hostname}`, function() {
				sydebar.Win.main.roster.removeBuddy(username);
			}
		);
	};

	sydebar.XMPP.sendDeviceList = function(deviceIds) {
		client.publish(
			`${sydebar.Me.username}@${sydebar.Hostname}`,
			'urn:xmpp:omemo:0:devicelist',
			{ devicelist: { deviceIds: deviceIds } }
		);
	};

	sydebar.XMPP.queryLastSeen = function(username) {
		client.sendIq({
			to: `${username}@${sydebar.Hostname}`,
			type: 'get',
			last: {}
		});
	};

	sydebar.XMPP.changePassword = function(username, password) {
		client.sendIq({
			to: sydebar.Hostname,
			type: 'set',
			register: {
				username: username,
				password: password
			}
		});
	};

	sydebar.XMPP.setAvatar = function(avatar) {
		sydebar.Me.avatar = avatar;
		client.publishAvatar(avatar);
	};

	sydebar.XMPP.getAvatar = function(username) {
		client.subscribeToNode(
			`${username}@${sydebar.Hostname}`,
			'urn:xmpp:avatar:data'
		);
		client.getAvatar(
			`${username}@${sydebar.Hostname}`
		);
	};

	sydebar.XMPP.deleteAccount = function(username) {
		client.deleteAccount(`${username}@${sydebar.Hostname}`, function() {
		});
	};

	sydebar.XMPP.sendBundle = function() {
		client.publish(
			`${sydebar.Me.username}@${sydebar.Hostname}`,
			'urn:xmpp:omemo:0:bundles:' + sydebar.Me.settings.deviceId,
			{ bundle: { bundleItems: {
				identityKey: sydebar.Me.settings.identityKey.pub,
				deviceName: sydebar.Me.settings.deviceName,
				deviceIcon: sydebar.Me.settings.deviceIcon,
				identityDHKey: sydebar.Me.settings.identityDHKey,
				signedPreKey: sydebar.Me.settings.signedPreKey.pub,
				signedPreKeySignature: sydebar.Me.settings.signedPreKeySignature,
				signedPreKeyId: sydebar.Me.settings.signedPreKeyId,
				preKeys: sydebar.Me.settings.preKeys
			} } }
		);
	};

	sydebar.XMPP.getDeviceList = function(username) {
		client.getItems(
			`${username}@${sydebar.Hostname}`,
			'urn:xmpp:omemo:0:devicelist'
		);
	};

	sydebar.XMPP.getBundle = function(username, deviceId) {
		client.subscribeToNode(
			`${username}@${sydebar.Hostname}`,
			'urn:xmpp:omemo:0:bundles:' + deviceId,
			function(err) {
				client.getItems(
					`${username}@${sydebar.Hostname}`,
					'urn:xmpp:omemo:0:bundles:' + deviceId
				);
			}
		);
	};

	sydebar.XMPP.deliverMessage = function(username, info) {
		var sendToWindow = function() {
			sydebar.Win.chat[username].webContents.send(
				'chat.receiveMessage', info
			);
			sydebar.Notify.playSound('message');
			if (!sydebar.Win.chat[username].isFocused()) {
				var notifText = info.plaintext;
				if (sydebar.Patterns.sticker.test(notifText)) {
					notifText = username + ' sent you a cat sticker!';
				}
				if (sydebar.Patterns.file.test(notifText)) {
					notifText = username + ' sent you a file.';
				}
				sydebar.Notify.showNotification(
					username, notifText, function() {
						sydebar.Win.chat[username].focus();
					}
				);
			}
		};
		if (!info.plaintext.length) { return false; }
		if (hasProperty(sydebar.Win.chat, username)) {
			if (sydebar.Win.chat[username].webContents.isLoading()) {
				setTimeout(function() {
					sydebar.XMPP.deliverMessage(username, info);
				}, 500);
			} else { sendToWindow(); }
		} else {
			sydebar.Win.create.chat(username, false, sendToWindow);
		}
	};

	sydebar.XMPP.disconnect = function(forceReconn, callback) {
		if (sydebar.Me.connected) {
			client.sendPresence({
				type: 'unavailable'
			});
		}
		if (typeof (callback) === 'function') {
			callbacks.disconnected = {
				armed: true,
				payload: callback
			};
		}
		if (!forceReconn) {
			sydebar.Me.connected = false;
		}
		client.disconnect();
	};
})();
