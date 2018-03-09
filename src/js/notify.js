'use strict';
sydebar.Notify = {
	sounds: {
		loggingIn: (new Audio('../snd/loggingIn.ogg')),
		loggedIn: (new Audio('../snd/loggedIn.ogg')),
		buddyOnline: (new Audio('../snd/buddyOnline.ogg')),
		buddyOffline: (new Audio('../snd/buddyOffline.ogg')),
		message: (new Audio('../snd/message.ogg'))
	}
};

(function() {
	Object.keys(sydebar.Notify.sounds).forEach((sound) => {
		sydebar.Notify.sounds[sound].load();
		sydebar.Notify.sounds[sound].volume = 0.5;
	});

	sydebar.Notify.playSound = function(sound) {
		if (sydebar.Me.settings.sounds) {
			sydebar.Notify.sounds[sound].play();
		}
	};

	sydebar.Notify.showNotification = function(title, body, callback) {
		if (sydebar.Me.settings.notify) {
			var n = new Notification('sydebar: ' + title, {
				title: 'sydebar: ' + title,
				body: body,
				silent: true
			});
			n.onclick = callback;
		}
	};
})();
