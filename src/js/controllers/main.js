define(['jquery'], function($) {
    return ['$scope', '$http', function($scope, $http) {
        var CAST_APP_ID = "938337b2-f581-41c4-b2c4-73e9cbe9e7ea",
            FEDR_NAMESPACE = 'cast.fedr.co',
            $localVideo = $('#localVideo');

        $scope.localReceiver = {
            active: false,
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
            length: 0,
            volume: 70
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
                if(receiver.type == 'local') {
                    if($scope.currentVideo) {
                        playVideo(receiver);
                    }
                }
                else if(receiver.type == 'remote') {
                    loadRemote(receiver);
                }
            }
            else {
                if(receiver.type == 'local') {
                    $scope.localReceiver.loaded = false;
                }
                else if(receiver.type == 'remote') {
                    if(receiver.activity) {
                        $scope.castApi.stopActivity(receiver.activity.activityId);
                    }
                    receiver.loaded = false;
                }
            }
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

        $scope.doTogglePlay = function() {
            $scope.play.playing = !$scope.play.playing;
            
            if($scope.play.playing) {
                $scope.receivers.forEach(function(receiver) {
                    if(receiver.active) {
                        if(receiver.type == 'local') {
                            $localVideo[0].play();
                        }
                        else if(receiver.type == 'remote') {
                            playRemoteVideo(receiver);
                        }
                    }
                });
            }
            else {
                $scope.receivers.forEach(function(receiver) {
                    if(receiver.active) {
                        if(receiver.type == 'local') {
                            $localVideo[0].pause();
                        }
                        else if(receiver.type == 'remote') {
                            pauseRemoteVideo(receiver);
                        }
                    }
                });
            }
        };

        function playVideo(receiver) {
            if(receiver.type == 'local') {
                receiver.loaded = false;
                $localVideo[0].src = $scope.currentVideo.src;
            }
            else if(receiver.type == 'remote') {
                if(receiver.activity) {
                    loadRemoteVideo(receiver);
                }
                else {
                    loadRemote(receiver);
                }
            }
        }
        
        function loadRemote(receiver) {
            receiver.active = 'loading';
            $scope.castApi.launch(new cast.LaunchRequest(CAST_APP_ID, receiver.receiver), function(activity) {
                $scope.$apply(function() {
                    if (activity.status == "running") {
                        receiver.activity = activity;
                        receiver.active = true;
                        $scope.castApi.addMediaStatusListener(activity.activityId, remoteMediaStatus);
                    }
                    else if (activity.status == "error") {
                        remoteError(receiver, activity);
                    }
                });
            });
        }

        function loadRemoteVideo(receiver) {
            var request = new cast.MediaLoadRequest($scope.currentVideo.src);
            request.title = $scope.currentVideo.name;
            $scope.castApi.loadMedia(receiver.activity.activityId, request, function(result) {
                if(result.success) {
                    receiver.loaded = true;
                    if($scope.play.playing) {
                        playRemoteVideo(receiver);
                    }
                }
                else {
                    // remoteError(receiver, result);
                }
            });
        }
        
        function playRemoteVideo(receiver) {
            if(receiver.loaded) {
                var request = new cast.MediaPlayRequest($scope.play.currentTime);
                $scope.castApi.playMedia(receiver.activity.activityId, request, function(result) {
                    // if(!result.success) {
                    //     remoteError(receiver, result);
                    // }
                });
            }
            else {
                loadRemoteVideo(receiver);
            }
        }
        
        function pauseRemoteVideo(receiver) {
            if(receiver.loaded) {
                $scope.castApi.pauseMedia(receiver.activity.activityId, function(result) {
                    // if(!result.success) {
                    //     remoteError(receiver, result);
                    // }
                });
            }
        }
        
        function remoteMediaStatus(status) {
            console.log(status);
            $scope.$apply(function() {
                $scope.play.length = status.duration;
                $scope.play.currentTime = status.position;
            });
        }
        
        function remoteError(receiver, err) {
            console.log(err);
            $scope.$apply(function() {
                if(receiver.activity) {
                    $scope.castApi.stopActivity(receiver.activity.activityId, function() {});
                }
                receiver.activity = null;
                receiver.active = 'error';
                receiver.loaded = false;
            });
        }

        $scope.doSeek = function() {
            $scope.receivers.forEach(function(receiver) {
                if(receiver.active  && receiver.loaded) {
                    if(receiver.type == 'local') {
                        $localVideo[0].currentTime = $scope.play.currentTime;
                    }
                    else if(receiver.type == 'remote') {
                        playRemoteVideo(receiver);
                    }
                }
            });
        };

        $scope.doVolume = function() {
            $scope.receivers.forEach(function(receiver) {
                if(receiver.active && receiver.loaded) {
                    if(receiver.type == 'local') {
                        $localVideo[0].volume = $scope.play.volume / 100;
                    }
                    else if(receiver.type == 'remote') {
                        $scope.castApi.setMediaVolume(
                            receiver.activity.activityId,
                            new cast.MediaVolumeRequest($scope.play.volume / 100, false),
                            function(result) {
                                //
                            });
                    }
                }
            });
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
                        $localVideo[0].play();
                    }
                });
            }
        });
    }];
});