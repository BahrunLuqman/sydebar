'use strict';
sydebar.Pinning = {};

(function() {
	var domains = {
		'sydebar.io': [{
			issuer: 'Gandi Standard SSL CA 2',
			subject: 'sydebar.io',
			exponent: '0x10001',
			modulus: (
				'C4B6B422A47FB1902A7436FA90AC7B17B4D88DB595CCBA5C3EF8FAE09D0EBB4D' +
				'44326F15A1DF9D45AF371560D805C3A16182E1133BFEB1E8943190A1161AD1D6' +
				'DBD1029513A6241CA8D964CB47A4EF502DE360683864387FADCB6A16CBD7D536' +
				'AD9B19CE109CB4C7CC54C94AFA142B652820824516CA88CEC215B44CC3EE37CE' +
				'84FE9849B4B8BFAF9406F4E79F45F932275481506A9FB31054ABE188C967C780' +
				'7AF099A97B3CE87F748EA0FA2A7305A99BE892EE1C2679816C4690AF75785702' +
				'3756D65ED0C7B1B8F1BEED47E77C184B061FD9F86A2C5925199E495CED7C955C' +
				'608C0BDCAB23185704B97892FBE19910C88CCCD510E13150648B6174BF309FD5'
			)
		}, {
			issuer: 'Gandi Standard SSL CA 2',
			subject: 'sydebar.io',
			exponent: '0x10001',
			modulus: (
				'C4B6B422A47FB1902A7436FA90AC7B17B4D88DB595CCBA5C3EF8FAE09D0EBB4D' +
				'44326F15A1DF9D45AF371560D805C3A16182E1133BFEB1E8943190A1161AD1D6' +
				'DBD1029513A6241CA8D964CB47A4EF502DE360683864387FADCB6A16CBD7D536' +
				'AD9B19CE109CB4C7CC54C94AFA142B652820824516CA88CEC215B44CC3EE37CE' +
				'84FE9849B4B8BFAF9406F4E79F45F932275481506A9FB31054ABE188C967C780' +
				'7AF099A97B3CE87F748EA0FA2A7305A99BE892EE1C2679816C4690AF75785702' +
				'3756D65ED0C7B1B8F1BEED47E77C184B061FD9F86A2C5925199E495CED7C955C' +
				'608C0BDCAB23185704B97892FBE19910C88CCCD510E13150648B6174BF309FD5'
			)
		}],
		'download.sydebar.io': [{
			issuer: 'Gandi Standard SSL CA 2',
			subject: 'download.sydebar.io',
			exponent: '0x10001',
			modulus: (
				'BC279AA8BE72EB431611494DE722C5AC267F7027D5750DD2A60CA4F50E74830B' +
				'59B1D843FFF6C62A18BD3610877888AA86553D8AA1812AC130CC56712F0E69B9' +
				'E3237F12F2E8A145401BAACCA75A692C7872CB3EC6F3EDCC836518C15C1D1867' +
				'6F0151BB348D7E174B5BFEBB744722F47D3512D2F9F819C6796EEEF828BD4D19' +
				'0C4217808C43FA7003630CD1E56C9CA8E0CA1AF45B1177BDAA6C6BEB7302296C' +
				'AF95FC1D55143EEEC3D19B9D16A4D0E81DAE231F196FFEE90676EA25175316DD' +
				'C18359B9F99F29A734FD4F1516F4A3FE5D61FA2D4658DD9B58D4765805CF25E6' +
				'2CB233DAFAC7744F5592AEEFB45B94D9A31BE17A041C7D1EEEE1462DFB950EB8' +
				'536A331493ECFB646C12EF9A746821BF8936E144E6729431EE7792B74AE47149' +
				'6A22867A897F706BE083FBC644669369DA98B5815FB94DD144B7B3BC5C2C154B' +
				'4E74B0005684A3B30621F2A7F1DF45775EE6BA28FF761FC4312BF139E8EC39BD' +
				'E1D733B56BB8CD0F10B3D30186F5B2EC8A80006392DBC7839976C4C0B67E65E9'
			)
		}, {
			issuer: 'Let\'s Encrypt Authority X3',
			subject: 'download.sydebar.io',
			exponent: '0x10001',
			modulus: (
				'BB34D8E4E4CC874EB84E61259788AC54CD7BEA3196E5C2872DA80F2FCFC4E6B6' +
				'56B169865C074EA4BB087FC9CD54C999B89B6099FAC925CF41354700C88A0837' +
				'3CB94E480F7867AAD93CF9466DDD36A44F03CE0B09CED64DC01AD07E10B91BBB' +
				'1CD17279A670FDD713154282AAA4BB60A05460A403AD00BBA480486824D5C95B' +
				'1701C67C7E783A3C3B1490D27AB9864AF338B74C40A291D0DD8A810E41CD5BCC' +
				'5C3A3D66770AB7DFD045BF7C7DB5B8A00B6D651E2EBEC13EBC6570F74E908DCD' +
				'A321627B415AF0A9740B516FC0F9AD919A2A9F8F0DAAB3E04FAC98E2994FCB36' +
				'058F8B48FF02670171D0F965760B2277C5A72B672C75038066C89A4F3628E657'
			)
		}]
	};

	var checkCert = function(c, d) {
		if (
			(c.issuer.CN === d.issuer) &&
			(c.subject.CN === d.subject) &&
			(c.exponent === d.exponent) &&
			(c.modulus === d.modulus)
		) {
			return true;
		}
		return false;
	};

	sydebar.Pinning.get = function(url, callback) {
		var domain = domains['sydebar.io'];
		if (url.startsWith('https://download.sydebar.io/')) {
			domain = domains['download.sydebar.io'];
		}
		var candidate = {};
		var get = HTTPS.request({
			hostname: domain[0].subject,
			port: 443,
			protocol: 'https:',
			path: NodeUrl.parse(url).pathname,
			agent: false
		}, function(res) {
			if (
				(checkCert(candidate, domain[0])) ||
				(checkCert(candidate, domain[1]))
			) {
				callback(res, true);
			} else {
				callback({}, false);
			}
		});
		get.on('socket', (socket) => {
			socket.on('secureConnect', function() {
				candidate = socket.getPeerCertificate();
			});
		});
		get.on('error', (e) => {
			callback({}, false);
		});
		get.end();
		return false;
	};
})();
