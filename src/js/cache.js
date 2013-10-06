define(['jquery'], function($) {
    if (window.applicationCache) {
    	$(function() {
    		window.applicationCache.addEventListener('updateready', function(e) {
    			console.log('cache', 'update', e);
    			if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
    				// Browser downloaded a new app cache.
    				// Swap it in and reload the page to get the new hotness.
    				try {
    					window.applicationCache.swapCache();
    				}
    				catch(err) {
    					console.log('cache', 'swap', err);
    				}
    				window.location.reload();
    			} else {
    			// Manifest didn't changed. Nothing new to server.
    			}
    		}, false);
    		window.applicationCache.addEventListener('noupdate', function() {
    			console.log('cache', 'noupdate');
    		}, false);
    		window.applicationCache.addEventListener('progress', function(e) {
    			console.log('cache', 'progress', (e.loaded / e.total) * 100, e);
    		}, false);
    		window.applicationCache.addEventListener('cached', function() {
    			console.log('App is now available offline');
    		}, false);
    		window.applicationCache.addEventListener('error', function(e) {
    			console.log('cache', 'error', e);
    		}, false);
    	});
    }
});

