/*global chrome:false */
angular.module('cast').controller('main', function ($scope, $http, $timeout, $localStorage) {
    var $localVideo = $('#localVideo'),
        session,
        currentMedia,
        seekLoop;

    $scope.videos = [
        {name: 'Bunny', src: 'http://video.webmfiles.org/big-buck-bunny_trailer.webm', mime: 'video/webm'}
    ];
    $scope.subtitles = [];
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
    $scope.currentSubtitleIdx = null;
    $scope.$localStorage = $localStorage.$default({
        autoplay: true
    });

    $scope.doLoadVideos = function () {
        $scope.videosLoading = true;
        $http.get('/api/videos').success(function (data) {
            $scope.videos = data;
            $scope.videosLoading = false;
            if (!$scope.videos.some(function(video) {
                    return video.src == $scope.currentVideo.src;
                })) {
                $scope.doChooseVideo(null);
            }
        }).error(function () {
            console.log(arguments);
            $scope.videosLoading = false;
        });
        $http.get('/api/subtitles').success(function(data) {
            $scope.subtitles = data;
        }).error(function() {
            console.log(arguments);
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
        $timeout.cancel(seekLoop);
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
        if (video) {
            $scope.play.playing = true;
            $scope.currentSubtitleIdx = null;
            if (!$scope.subtitles.some(function (subtitle, idx) {
                if (subtitle.name == video.name) {
                    $scope.currentSubtitleIdx = idx;
                    return true;
                }
            })) {
                $scope.currentSubtitleIdx = null;
            }
            $localVideo[0].src = video.src;
            if ($scope.play.remote === true) {
                remoteLoadVideo(video);
            }
        }
        else {
            $scope.play.playing = false;
            $scope.currentSubtitleIdx = null;
            $localVideo[0].src = null;
            if ($scope.play.remote === true) {
                $scope.play.remote = 'pending';
                session.stop(function() {
                    console.log('stop', e);
                    $scope.play.remote = false;
                }, function onError(e) {
                    console.error('stop error', e);
                    $scope.play.remote = true;
                });
            }
        }
        [].forEach.call($localVideo[0].textTracks, function (track, idx) {
            track.mode = $scope.currentSubtitleIdx == idx ? 'showing' : 'hidden';
        });
    };

    function remoteLoadVideo(video) {
        var media = new chrome.cast.media.MediaInfo(video.src, video.mime),
            request = new chrome.cast.media.LoadRequest(media),
            activeSubtitles;
        media.metadata = new chrome.cast.media.GenericMediaMetadata();
        media.metadata.title = video.name;
        media.tracks = $scope.subtitles.map(function(subtitle, idx) {
            var track = new chrome.cast.media.Track(idx + 1, chrome.cast.media.TrackType.TEXT);
            track.trackContentId = subtitle.src;
            track.contentType = subtitle.mime;
            track.subtype = chrome.cast.media.TextTrackType.SUBTITLES;
            track.name = subtitle.name;
            track.language = 'en-US';
            track.customData = null;
            return track;
        });
        media.textTrackStyle = new chrome.cast.media.TextTrackStyle();
        request.activeTrackIds = $scope.currentSubtitleIdx ? [$scope.currentSubtitleIdx + 1] : [];
        session.loadMedia(request, onMediaDiscovered.bind(this, 'loadMedia'), function (e) {
            console.error('media error', e, media, request);
            if (e.description !== 'LOAD_CANCELLED') {
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
            console.log('status', playing, media.playerState, media.currentTime, media.idleReason);
            $scope.$apply(function () {
                $scope.play.currentTime = media.currentTime;
                $scope.play.volume = media.volume.level * 100;
                $scope.play.muted = media.volume.muted;
                $scope.play.playing = media.playerState === chrome.cast.media.PlayerState.PLAYING || media.playerState === chrome.cast.media.PlayerState.BUFFERING;
                $scope.play.buffering = media.playerState === chrome.cast.media.PlayerState.BUFFERING;
            });
            $timeout.cancel(seekLoop);
            if (media.playerState === chrome.cast.media.PlayerState.PLAYING) {
                seekLoop = $timeout(function seekUpdate() {
                    $scope.play.currentTime++;

                    if ($scope.play.currentTime > 120) {
                        $localStorage[$scope.currentVideo.src] = true;
                    }

                    seekLoop = $timeout(seekUpdate, 1000);
                }, 1000);
            }
            else if (media.playerState === chrome.cast.media.PlayerState.IDLE && media.idleReason === chrome.cast.media.IdleReason.FINISHED && $localStorage.autoplay) {
                $scope.videos.some(function (video, idx) {
                    if ($scope.currentVideo.src === video.src) {
                        $scope.doChooseVideo($scope.videos[idx + 1]);
                        return true;
                    }
                });
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

    $scope.doChooseSubtitle = function(subtitleIdx) {
        if ($scope.currentSubtitleIdx == subtitleIdx) {
            $scope.currentSubtitleIdx = null;
        }
        else {
            $scope.currentSubtitleIdx = subtitleIdx;
        }
        [].forEach.call($localVideo[0].textTracks, function(track, idx) {
            track.mode = $scope.currentSubtitleIdx == idx ? 'showing' : 'hidden';
        });
        if ($scope.play.remote) {
            if (currentMedia) {
                currentMedia.editTracksInfo(new chrome.cast.media.EditTracksInfoRequest(subtitleIdx ? [subtitleIdx + 1] : []), function success(e) {
                    console.log('tracks', e);
                }, function error(e) {
                    console.error('tracks error', e);
                    currentMedia = null;
                    $scope.$apply(function () {
                        $scope.play.playing = false;
                    });
                });
            }
        }
    };

    $scope.doDeleteVideo = function(video) {
        if (confirm('Are you sure you want to delete ' + video.name + '?')) {
            $http.delete(video.src).then(function () {
                $scope.videos = $scope.videos.filter(function (v) {
                    return v.src != video.src;
                });
                if (!$scope.videos.some(function(video) {
                        return video.src == $scope.currentVideo.src;
                    })) {
                    $scope.doChooseVideo(null);
                }
            });
        }
    };

    //Start cast
    if (window.chrome && chrome.cast && chrome.cast.isAvailable) {
        initializeCast();
    }
    else {
        window.__onGCastApiAvailable = function(loaded, errorInfo) {
            if (loaded) {
                initializeCast();
            } else {
                console.log(errorInfo);
            }
        };
    }
});
