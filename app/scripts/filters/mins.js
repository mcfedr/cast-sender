angular.module('cast').filter('mins', function () {
    return function (text) {
        var mins = Math.floor(text / 60),
            secs = Math.floor(text % 60);
        if (secs < 10) {
            secs = '0' + secs;
        }
        return mins + ':' + secs;
    };
});
