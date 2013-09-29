define(function() {
    return ['$scope', '$http', function CastC($scope, $http) {
        var CAST_APP_ID = "938337b2-f581-41c4-b2c4-73e9cbe9e7ea",
            $localVideo = $('#localVideo');

        $scope.localReceiver = {
            active: true,
            loaded: false,
            type: 'local',
            receiver: {
                name: 'Local'
            }
        };
        $scope.receivers = [$scope.localReceiver];
        $scope.videos = [{name: 'Bunny', src: 'http://video.webmfiles.org/big-buck-bunny_trailer.webm'}];
        $scope.play = {
            playing: false,
            currentTime: 0,
            length: 0
        };

        $scope.castApi = false;


        $scope.doLoadVideos = function() {
            $scope.videosLoading = true;
            $http.get('/api/videos').success(function(data) {
                $scope.videos = data;
                $scope.videosLoading = false;
            }).error(function() {
                console.log(arguments);
                $scope.videosLoading = false;
            });
        };

        $scope.doLoadVideos();

        if (window.cast && cast.isAvailable) {
            // Cast is known to be available
            initializeCast();
        }
        else {
            // Wait for API to post a message to us
            window.addEventListener("message", function(event) {
                if (event.source == window && event.data &&
                    event.data.source == "CastApi" &&
                    event.data.event == "Hello") {
                    initializeCast();
                }
            });
        };

        function initializeCast() {
            $scope.castApi = new cast.Api();
            $scope.castApi.addReceiverListener(CAST_APP_ID, function(list) {
                $scope.$apply(function() {
                    $scope.receivers = list.map(function(receiver) {
                        return {
                            active: false,
                            type: 'remote',
                            receiver: receiver
                        };
                    }).concat([$scope.localReceiver]);
                });
            });
        }

        $scope.doToggleReceiver = function(receiver) {
            receiver.active = !receiver.active;

            if(receiver.active) {
                if($scope.currentVideo) {
                    playVideo($scope.currentVideo, receiver);
                }
            }
            else {
                if(receiver.type == 'local') {
                    $scope.localReceiver.loaded = false;
                }
            }
        };

        $scope.doTogglePlay = function() {
            if($scope.play.playing) {
                $localVideo[0].pause();
            }
            else {
                $localVideo[0].play();
            }
            $scope.play.playing = !$scope.play.playing;
        };

        $scope.doChooseVideo = function(video) {
            $scope.currentVideo = video;
            $scope.play.currentTime = 0;
            $scope.play.playing = true;
            $scope.receivers.forEach(function(receiver) {
                if(receiver.active) {
                    playVideo(receiver);
                }
            });
        };

        function playVideo(receiver) {
            if(receiver.type == 'local') {
                receiver.loaded = false;
                $localVideo[0].src = $scope.currentVideo.src;
            }
            if(receiver.type == 'remote') {
                if(receiver.activity) {
                    playRemoteVideo(receiver.activity);
                }
                else {
                    receiver.active = 'loading';
                    $scope.castApi.launch(new cast.LaunchRequest(CAST_APP_ID, receiver.receiver), function(activity) {
                        $scope.$apply(function() {
                            if (activity.status == "running") {
                                receiver.activity = activity;
                                receiver.active = true;
                                playRemoteVideo(activity);
                            }
                            else if (activity.status == "error") {
                                receiver.activity = null;
                                receiver.active = 'error';
                            }
                        });
                    });
                }
            }
        }

        function playRemoteVideo(activity) {
            $scope.castApi.loadMedia(activity.activityId, new cast.MediaLoadRequest($scope.currentVideo.src), remoteVideoLoaded);
        }

        function remoteVideoLoaded() {
            //PlayRequest
        }

        $scope.doSeek = function() {
            if($scope.localReceiver.loaded) {
                $localVideo[0].currentTime = $scope.play.currentTime;
            }
        };

        $localVideo.on('timeupdate', function() {
            if($scope.localReceiver.loaded) {
                $scope.$apply(function() {
                    $scope.play.currentTime = $localVideo[0].currentTime;
                });
            }
        });

        $localVideo.on('loadedmetadata', function() {
            if($scope.localReceiver.active) {
                $scope.$apply(function() {
                    $localVideo[0].currentTime = $scope.play.currentTime;
                    $scope.play.length = $localVideo[0].duration;
                    $scope.localReceiver.loaded = true;
                    if($scope.play.playing) {
                        $localVideo.play();
                    }
                });
            }
        });
    }];
});