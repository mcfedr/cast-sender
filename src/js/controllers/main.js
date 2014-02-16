define(['jquery', 'cast'], function($, cast) {
    return ['$scope', '$http', function($scope, $http) {
        var $localVideo = $('#localVideo'),
            session,
            currentMedia;

        $scope.videos = [{name: 'Bunny', src: 'http://video.webmfiles.org/big-buck-bunny_trailer.webm', mime: 'video/webm'}];
        $scope.videosLoading = false;
        $scope.play = {
            playing: false,
            buffering: false,
            currentTime: 0,
            length: 0,
            volume: 100,
            muted: false,
            remote: false,
            remoteAvailable: false
        };
        $scope.currentVideo = null;

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

        if (cast.isAvailable) {
            // Cast is known to be available
            initializeCast();
        }
        else {
            setTimeout(initializeCast, 1000);
        }

        function initializeCast() {
            var sessionRequest = new cast.SessionRequest(cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
            var apiConfig = new cast.ApiConfig(sessionRequest, function sessionListener(s) {
                console.log('session', s);
                session = s;
                if (session.media.length != 0) {
                    onMediaDiscovered('onRequestSessionSuccess', session.media[0]);
                }
                $scope.$apply(function() {
                    $scope.play.remote = true;
                });
            }, function receiverListener(e) {
                console.log('receiver', e);
                $scope.$apply(function() {
                    $scope.play.remoteAvailable = e === 'available';
                });
            });
            cast.initialize(apiConfig, function onInitSuccess(e) {
                console.log('init', e);
            }, function onInitError(e) {
                console.log('init error', e);
            });
        }

        $scope.doToggleCast = function() {
            if ($scope.play.remote === true) {
                $scope.play.remote = 'pending';
                session.stop(function onSuccess(e) {
                    console.log('stop', e);
                    $localVideo[0].currentTime = $scope.play.currentTime;
                    $localVideo[0].volume = $scope.play.volume / 100;
                    if ($scope.play.playing) {
                        $localVideo[0].play();
                    }
                    $scope.play.remote = false;
                }, function onError(e) {
                    console.log('stop error', e);
                    $scope.play.remote = true;
                });
            }
            else if ($scope.play.remote === false) {
                if ($scope.play.playing) {
                    $localVideo[0].pause();
                }
                $scope.play.remote = 'pending';
                cast.requestSession(function onRequestSessionSuccess(s) {
                    console.log('request session success', s);
                    session = s;
                    $scope.$apply(function() {
                        $scope.play.remote = true;
                    });
                    if ($scope.currentVideo) {
                        remoteLoadVideo($scope.currentVideo);
                    }
                }, function onLaunchError(e) {
                    console.log('launch error', e);
                    $scope.$apply(function() {
                        $scope.play.remote = false;
                    });
                });
            }
        };

        $scope.doChooseVideo = function(video) {
            $scope.currentVideo = video;
            $scope.play.currentTime = 0;
            $scope.play.playing = true;
            $localVideo[0].src = video.src;
            if($scope.play.remote === true) {
                remoteLoadVideo(video);
            }
        };

        function remoteLoadVideo(video) {
            var media = new cast.media.MediaInfo(video.src, video.mime),
                request = new cast.media.LoadRequest(media);
            media.metadata = new cast.media.GenericMediaMetadata();
            media.metadata.title = video.name;
            session.loadMedia(request, onMediaDiscovered.bind(this, 'loadMedia'), function onMediaError(e) {
                console.log('media error', e);
            });
        }

        function onMediaDiscovered(how, media) {
            console.log('media', media);
            currentMedia = media;
            $scope.$apply(function() {
                $scope.play.length = media.media.duration;
                if (!$scope.currentVideo) {
                    $scope.videos.some(function(video) {
                        if(video.src == media.media.contentId) {
                            $scope.currentVideo = video;
                            $localVideo[0].src = video.src;
                            return true;
                        }
                    });
                }
            });

            media.addUpdateListener(function onMediaStatusUpdate(status) {
                console.log('status', status, media.playerState);
                if(status) {
                    $scope.$apply(function() {
                        $scope.play.currentTime = media.currentTime;
                        $scope.play.volume = media.volume.level * 100;
                        $scope.play.muted = media.volume.muted;
                        $scope.play.playing = media.playerState == cast.media.PlayerState.PLAYING || media.playerState == cast.media.PlayerState.BUFFERING;
                        $scope.play.buffering = media.playerState == cast.media.PlayerState.BUFFERING;
                    });
                }
                else {
                    session = currentMedia = null;
                    $scope.$apply(function() {
                        $scope.play.playing = false;
                        $scope.play.remote = false;
                    });
                }
            });

            if($scope.play.playing) {
                var seekRequest = new cast.media.SeekRequest();
                seekRequest.currentTime = $scope.play.currentTime;
                seekRequest.resumeState = cast.media.ResumeState.PLAYBACK_START;
                currentMedia.seek(seekRequest, function success(e) {
                    console.log('seek', e);
                }, function error(e) {
                    console.log('seek error', e);
                });
            }
        }

        $scope.doTogglePlay = function() {
            $scope.play.playing = !$scope.play.playing;
            
            if($scope.play.playing) {
                if($scope.play.remote) {
                    if (currentMedia) {
                        currentMedia.play(null, function success(e) {
                            console.log('play', e);
                        }, function error(e) {
                            console.log('play error', e);
                        });
                    }
                }
                else {
                    $localVideo[0].play();
                }
            }
            else {
                if($scope.play.remote) {
                    if (currentMedia) {
                        currentMedia.pause(null, function success(e) {
                            console.log('pause', e);
                        }, function error(e) {
                            console.log('pause error', e);
                        });
                    }
                }
                else {
                    $localVideo[0].pause();
                }
            }
        };

        $scope.doSeek = function() {
            if ($scope.play.remote) {
                if (currentMedia) {
                    var seekRequest = new cast.media.SeekRequest();
                    seekRequest.currentTime = $scope.play.currentTime;
                    currentMedia.seek(seekRequest, function success(e) {
                        console.log('seek', e);
                    }, function error(e) {
                        console.log('seek error', e);
                    });
                }
            }
            else {
                $localVideo[0].currentTime = $scope.play.currentTime;
            }
        };

        $scope.doVolume = function() {
            if ($scope.play.remote) {
                if (currentMedia) {
                    currentMedia.setVolume(new cast.media.VolumeRequest(new cast.Volume($scope.play.volume / 100)), function success(e) {
                        console.log('volume', e);
                    }, function error(e) {
                        console.log('volume error', e);
                    });
                }
            }
            else {
                $localVideo[0].volume = $scope.play.volume / 100;
            }
        };

        $localVideo.on('timeupdate', function() {
            if (!$scope.play.remote) {
                $scope.$apply(function() {
                    $scope.play.currentTime = $localVideo[0].currentTime;
                });
            }
        });

        $localVideo.on('loadedmetadata', function() {
            if (!$scope.play.remote) {
                $scope.$apply(function() {
                    $localVideo[0].currentTime = $scope.play.currentTime;
                    $scope.play.length = $localVideo[0].duration;
                    if($scope.play.playing) {
                        $localVideo[0].play();
                    }
                });
            }
        });

        $scope.doToggleFullscreen = function() {
            if (!$scope.play.remote) {
                if ($localVideo[0].requestFullscreen) {
                    $localVideo[0].requestFullscreen();
                }
                else if ($localVideo[0].mozRequestFullScreen) {
                    $localVideo[0].mozRequestFullScreen();
                }
                else if ($localVideo[0].webkitRequestFullscreen) {
                    $localVideo[0].webkitRequestFullscreen();
                }
            }
        };
    }];
});
