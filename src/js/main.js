require.config({
    paths: {
        angular: '../bower_components/angular/angular',
        angularAnimate: '../bower_components/angular-animate/angular-animate',
        angularCache: '../bower_components/angular-cache/src/angular-cache',
        jquery: '../bower_components/jquery/jquery',
        bootstrap: '../bower_components/bootstrap/dist/js/bootstrap'
    },
    baseUrl: 'js',
    shim: {
        angular : {
            exports : 'angular',
            deps: ['jquery']
        },
        angularAnimate: ['angular'],
        angularCache: ['angular'],
        bootstrap: ['jquery']
    },
    priority: ['angular']
});

// hey Angular, we're bootstrapping manually!
//window.name = "NG_DEFER_BOOTSTRAP!";

require([
    'angular',
    'controllers/main',
    'filters/mins',
    'angularAnimate',
    'bootstrap',
    'cache'
], function(angular, mainC, minsF) {
    var $html = angular.element(document.getElementsByTagName('html')[0]),
        app = angular.module('cast', [
                'ngAnimate'
            ])
            .controller('cast.main', mainC)
            .filter('mins', minsF);

    angular.element().ready(function() {
        $html.addClass('ng-app');
        angular.bootstrap(document, [app['name']]);
    });
});
