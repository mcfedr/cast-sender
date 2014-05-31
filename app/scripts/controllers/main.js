angular.module('cast').controller('main', function ($scope, $http, $timeout) {
    var $localVideo = $('#localVideo'),
        session,
        currentMedia,
        seekLoop;

    $scope.videos = [
        {name: 'Bunny', src: 'http://video.webmfiles.org/big-buck-bunny_trailer.webm', mime: 'video/webm'}
    ];
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

    $scope.doLoadVideos = function () {
        $scope.videosLoading = true;
        $http.get('/api/videos').success(function (data) {
            $scope.videos = data;
            $scope.videosLoading = false;
        }).error(function () {
            console.log(arguments);
            $scope.videosLoading = false;
        });
    };

    $scope.doLoadVideos();

    function initializeCast() {
        var sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
        var apiConfig = new chrome.cast.ApiConfig(sessionRequest, function sessionListener(s) {
            console.log('session', s);
            session = s;
            if (session.media.length !== 0) {
                onMediaDiscovered('onRequestSessionSuccess', session.media[0]);
            }
            $scope.$apply(function () {
                $scope.play.remote = true;
            });
        }, function receiverListener(e) {
            console.log('receiver', e);
            $scope.$apply(function () {
                $scope.play.remoteAvailable = e === 'available';
            });
        });
        chrome.cast.initialize(apiConfig, function onInitSuccess(e) {
            console.log('init', e);
        }, function onInitError(e) {
            console.error('init error', e);
        });
    }

    $scope.doToggleCast = function (remote) {
        if (remote !== undefined) {
            $scope.play.remote = !remote;
        }
        if ($scope.play.remote === true) {
            $scope.play.remote = 'pending';
            session.stop(function onSuccess(e) {
                console.log('stop', e);
                if ($localVideo[0].src) {
                    $localVideo[0].currentTime = $scope.play.currentTime;
                    $localVideo[0].volume = $scope.play.volume / 100;
                    if ($scope.play.playing) {
                        $localVideo[0].play();
                    }
                }
                $scope.play.remote = false;
            }, function onError(e) {
                console.error('stop error', e);
                $scope.play.remote = true;
            });
        }
        else if ($scope.play.remote === false) {
            if ($scope.play.playing) {
                $localVideo[0].pause();
            }
            $scope.play.remote = 'pending';
            chrome.cast.requestSession(function onRequestSessionSuccess(s) {
                console.log('request session success', s);
                session = s;
                $scope.$apply(function () {
                    $scope.play.remote = true;
                });
                if ($scope.currentVideo) {
                    remoteLoadVideo($scope.currentVideo);
                }
            }, function onLaunchError(e) {
                console.error('launch error', e);
                session = currentMedia = null;
                $scope.$apply(function () {
                    $scope.play.playing = false;
                    $scope.play.remote = false;
                });
            });
        }
    };

    $scope.doChooseVideo = function (video) {
        $scope.currentVideo = video;
        $scope.play.currentTime = 0;
        $scope.play.playing = true;
        $localVideo[0].src = video.src;
        if ($scope.play.remote === true) {
            remoteLoadVideo(video);
        }
    };

    function remoteLoadVideo(video) {
        var media = new chrome.cast.media.MediaInfo(video.src, video.mime),
            request = new chrome.cast.media.LoadRequest(media);
        media.metadata = new chrome.cast.media.GenericMediaMetadata();
        media.metadata.title = video.name;
        session.loadMedia(request, onMediaDiscovered.bind(this, 'loadMedia'), function (e) {
            console.error('media error', e);
            if (e.description != 'LOAD_CANCELLED') {
                currentMedia = null;
                $scope.$apply(function () {
                    $scope.play.playing = false;
                    $scope.doToggleCast(false);
                });
            }
        });
    }

    function onMediaDiscovered(how, media) {
        console.log('media', how, media);
        currentMedia = media;
        $scope.$apply(function () {
            $scope.play.length = media.media.duration;
            if (!$scope.currentVideo) {
                $scope.videos.some(function (video) {
                    if (video.src === media.media.contentId) {
                        $scope.currentVideo = video;
                        $localVideo[0].src = video.src;
                        return true;
                    }
                });
            }
        });

        media.addUpdateListener(function onMediaStatusUpdate(playing) {
            console.log('status', playing, media.playerState);
            $scope.$apply(function () {
                $scope.play.currentTime = media.currentTime;
                $scope.play.volume = media.volume.level * 100;
                $scope.play.muted = media.volume.muted;
                $scope.play.playing = media.playerState == chrome.cast.media.PlayerState.PLAYING || media.playerState == chrome.cast.media.PlayerState.BUFFERING;
                $scope.play.buffering = media.playerState == chrome.cast.media.PlayerState.BUFFERING;
            });
            $timeout.cancel(seekLoop);
            if (media.playerState == chrome.cast.media.PlayerState.PLAYING) {
                seekLoop = $timeout(function seekUpdate() {
                    $scope.play.currentTime++;
                    seekLoop = $timeout(seekUpdate, 1000);
                }, 1000);
            }
            else if (media.playerState == chrome.cast.media.PlayerState.IDLE && media.currentTime == media.duration) {
                var foundIdx;
                $scope.videos.some(function (video, idx) {
                    if ($scope.currentVideo.src == video.src) {
                        foundIdx = idx;
                        return true;
                    }
                });
                if (foundIdx && $scope.videos[foundIdx + 1]) {
                    $scope.doChooseVideo($scope.videos[foundIdx + 1]);
                }
            }
        });

        if ($scope.play.playing) {
            var seekRequest = new chrome.cast.media.SeekRequest();
            seekRequest.currentTime = $scope.play.currentTime;
            seekRequest.resumeState = chrome.cast.media.ResumeState.PLAYBACK_START;
            currentMedia.seek(seekRequest, function success(e) {
                console.log('seek', e);
            }, function error(e) {
                console.error('seek error', e);
                currentMedia = null;
                $scope.$apply(function () {
                    $scope.play.playing = false;
                });
            });
        }
    }

    $scope.doTogglePlay = function () {
        $scope.play.playing = !$scope.play.playing;

        if ($scope.play.playing) {
            if ($scope.play.remote) {
                if (currentMedia) {
                    currentMedia.play(null, function success(e) {
                        console.log('play', e);
                    }, function error(e) {
                        console.error('play error', e);
                        currentMedia = null;
                        $scope.$apply(function () {
                            $scope.play.playing = false;
                        });
                    });
                }
            }
            else {
                $localVideo[0].play();
            }
        }
        else {
            if ($scope.play.remote) {
                if (currentMedia) {
                    currentMedia.pause(null, function success(e) {
                        console.log('pause', e);
                    }, function error(e) {
                        console.error('pause error', e);
                        currentMedia = null;
                        $scope.$apply(function () {
                            $scope.play.playing = false;
                        });
                    });
                }
            }
            else {
                $localVideo[0].pause();
            }
        }
    };

    $scope.doSeek = function () {
        if ($scope.play.remote) {
            if (currentMedia) {
                var seekRequest = new chrome.cast.media.SeekRequest();
                seekRequest.currentTime = $scope.play.currentTime;
                currentMedia.seek(seekRequest, function success(e) {
                    console.log('seek', e);
                }, function error(e) {
                    console.error('seek error', e);
                    currentMedia = null;
                    $scope.$apply(function () {
                        $scope.play.remote = false;
                    });
                });
            }
        }
        else {
            $localVideo[0].currentTime = $scope.play.currentTime;
        }
    };

    $scope.doVolume = function () {
        if ($scope.play.remote) {
            if (currentMedia) {
                currentMedia.setVolume(new chrome.cast.media.VolumeRequest(new chrome.cast.Volume($scope.play.volume / 100)), function success(e) {
                    console.log('volume', e);
                }, function error(e) {
                    console.error('volume error', e);
                    currentMedia = null;
                    $scope.$apply(function () {
                        $scope.play.playing = false;
                    });
                });
            }
        }
        else {
            $localVideo[0].volume = $scope.play.volume / 100;
        }
    };

    $localVideo.on('timeupdate', function () {
        if (!$scope.play.remote) {
            $scope.$apply(function () {
                $scope.play.currentTime = $localVideo[0].currentTime;
            });
        }
    });

    $localVideo.on('loadedmetadata', function () {
        if (!$scope.play.remote) {
            $scope.$apply(function () {
                $localVideo[0].currentTime = $scope.play.currentTime;
                $scope.play.length = $localVideo[0].duration;
                if ($scope.play.playing) {
                    $localVideo[0].play();
                }
            });
        }
    });

    $scope.doToggleFullscreen = function () {
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

    //Start cast
    if (window.chrome && chrome.cast && chrome.cast.isAvailable) {
        initializeCast();
    }
    else {
        window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
            if (loaded) {
                initializeCast();
            } else {
                console.log(errorInfo);
            }
        }
    }
});