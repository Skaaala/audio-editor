import {UiHelper} from './ui-helper';
import {Helper} from './helper';
import {BufferUtils} from './buffer-utils';

declare var peaks;
declare var html2canvas;
declare var $;

class AudioEditor {
    private duration;
    private context;
    private SEEK_STEP;
    private UNDO_SNAPSHOTS_MAX_COUNT;

    private WAVEFORM_CONTAINER;
    private WAVEFORM_CONTAINER_ELEMENT;
    private soundBuffer;
    private ZOOM_SECOND_MULTIPLIER;

    private BufferUtilsInstance;
    private HelperInstance;
    private UIHelperInstance;

    private peaksInstance;
    private callbacks;
    private currentPixelOffset;

    private msgElement;
    private mediaElement;
    private loader;
    private volumeSliderValue;
    private soundBufferSnapshots;

    private lastStart;
    private lastEnd;
    private lastArrayBuffer;
    private lastDuration;

    private zoomLevels;

    private KEYS;
    private COLOR;

    private centerZoomIndex;

    constructor(duration) {
        this.duration = duration;
        this.context = new (window.AudioContext || window['webkitAudioContext'])();

        this.SEEK_STEP = 5;
        this.UNDO_SNAPSHOTS_MAX_COUNT = 1;

        this.KEYS = {
            SPACE: 32,
            ARROW_LEFT: 37,
            ARROW_UP: 38,
            ARROW_RIGHT: 39,
            ARROW_DOWN: 40,
            A: 65
        };

        this.COLOR = {
            POINT: '#18bce0',
            SELECTION: '#f44b42',
            WAVEFORM_ZOOM: '#87c442',
            WAVEFORM_OVERVIEW: '#bbb'
        };

        this.WAVEFORM_CONTAINER = '#mvaudio__waveform-container';
        this.WAVEFORM_CONTAINER_ELEMENT = document.querySelector(this.WAVEFORM_CONTAINER);
        this.soundBuffer = null;
        this.ZOOM_SECOND_MULTIPLIER = 24;    // experimental

        this.BufferUtilsInstance = new BufferUtils(this.context);
        this.HelperInstance = new Helper(this.context);
        this.UIHelperInstance = new UiHelper();

        this.peaksInstance;
        this.callbacks = {};
        this.currentPixelOffset = null;

        this.msgElement = document.querySelector('#mvaudio__message');
        this.mediaElement = document.querySelector('#mvaudio__audio-element') as HTMLMediaElement;
        this.loader = $('#mvaudio__loader');
        this.volumeSliderValue = 0;
        this.soundBufferSnapshots = [];

        this.lastStart = null;
        this.lastEnd = null;
        this.lastArrayBuffer = null;
        this.lastDuration = null;

        this.zoomLevels = [];

        this.initZoomLevels(this.duration);
        this.centerZoomIndex = Math.floor((this.zoomLevels.length - 1) / 2);

        this.setLoading(true);

        this.initPeaks(0, {initialZoom: this.centerZoomIndex});

        this.initButtonListeners();
        this.initKeyListeners();
        this.initMouseWheelListener();
        this.initVolumeSlider();
        this.initMouseClickListener();
    }

    private initPeaks(time, options) {

        if (this.peaksInstance) {
            this.peaksInstance.destroy();
        }

        this.peaksInstance = peaks.init({
            containers: {
                zoomview: this.WAVEFORM_CONTAINER_ELEMENT
            },
            mediaElement: this.mediaElement,
            audioContext: this.context,
            zoomLevels: this.zoomLevels,
            zoomWaveformColor: this.COLOR.WAVEFORM_ZOOM,
            overviewWaveformColor: this.COLOR.WAVEFORM_OVERVIEW,
            preparedAudioBuffer: this.soundBuffer,
            lastStart: this.lastStart,
            lastEnd: this.lastEnd,
            isDelete: options.isDelete || false
        });

        this.peaksInstance.on('peaks.ready', () => {
            this.soundBuffer = this.peaksInstance._audioBuffer;

            if (!this.lastArrayBuffer || options.isUndo) {
                this.lastArrayBuffer = this.HelperInstance.bufferToWave(this.soundBuffer, this.soundBuffer.duration * this.soundBuffer.sampleRate);
            }

            this.updateUI();

            this.peaksInstance.zoom.setZoom(options.initialZoom);

            if (time) {
                this.peaksInstance.player.seek(time);
            }
            if (this.currentPixelOffset) {
                this.peaksInstance.emit('user_scroll.zoomview', this.currentPixelOffset);
            }

            if (this.lastDuration != this.soundBuffer.duration) {
                this.notifyChangeDuration(this.HelperInstance.getFormattedDuration(this.soundBuffer.duration));
                this.lastDuration = this.soundBuffer.duration;
            }

            this.setLoading(false);
            this.hideCanvasSnapshot();
        });

        this.peaksInstance.on('points.add', () => {
            this.updateUI();
        });

        this.peaksInstance.on('points.remove', () => {
            this.updateUI();
        });

        this.peaksInstance.on('points.remove_all', () => {
            this.updateUI();
        });

        this.peaksInstance.on('points.dragmove', () => {
            this.updateSelection();
        });

        this.peaksInstance.on('user_scroll.zoomview', (pixelOffset) => {
            this.currentPixelOffset = pixelOffset;
        });
    }

    private initButtonListeners() {
        $('#mvaudio__controls').show();
        $('#mvaudio__btn-seek-forward').on('click', () => this.seekForward());
        $('#mvaudio__btn-seek-backward').on('click', () => this.seekBackward());
        $('#mvaudio__btn-play').on('click', () => this.play());
        $('#mvaudio__btn-pause').on('click', () => this.pause());
        $('#mvaudio__btn-add-point').on('click', () => this.addPoint());
        $('#mvaudio__btn-select-all').on('click', () => this.selectAll());
        $('#mvaudio__btn-remove-points').on('click', () => this.removePoints());
        $('#mvaudio__btn-delete').on('click', () => this.deleteSelection());
        $('#mvaudio__btn-change-volume').on('click', () => this.changeVolumeSelection());
        $('#mvaudio__btn-beep').on('click', () => this.beepSelection());
        $('#mvaudio__btn-fade-in').on('click', () => this.fadeInSelection());
        $('#mvaudio__btn-fade-out').on('click', () => this.fadeOutSelection());
        $('#mvaudio__btn-undo').on('click', () => this.undo());
        $('#mvaudio__btn-save').on('click', () => this.save());

        this.UIHelperInstance.bindOnMousePressed('#mvaudio__btn-zoom-in', this.zoomIn);
        this.UIHelperInstance.bindOnMousePressed('#mvaudio__btn-zoom-out', this.zoomOut);

        //set disabled buttons
        this.updateUI();
    }

    private initKeyListeners() {
        $(document).keydown((e: any) => {
            switch (e.which) {
                case this.KEYS.SPACE:
                    this.peaksInstance.player._isPlaying ? this.pause() : this.play();
                    break;
                case this.KEYS.ARROW_LEFT:
                    this.seekBackward();
                    break;
                case this.KEYS.ARROW_RIGHT:
                    this.seekForward();
                    break;
                case this.KEYS.A:
                    if (e.ctrlKey == true) {
                        this.selectAll();
                    }
                    break;
                default:
                    return; // exit this handler for other keys
            }
            e.preventDefault(); // prevent the default action (scroll / move caret)
        });
    }

    private initMouseWheelListener() {
        let threshold = 50;
        let deltaY = 0;

        $(this.WAVEFORM_CONTAINER).on('mousewheel DOMMouseScroll',  (e: any) => {
            if (e.originalEvent.ctrlKey) {
                e.preventDefault();
                deltaY += this.HelperInstance.extractDelta(e);
                if (deltaY > threshold) {
                    this.zoomOut();
                    deltaY = 0;
                } else if (deltaY < -threshold) {
                    this.zoomIn();
                    deltaY = 0;
                }
            }
        });
    }

    private initMouseClickListener() {
        $(this.WAVEFORM_CONTAINER).on('dblclick',  (e) => {
            this.addPoint();
            e.preventDefault();
        });
    }

    private initVolumeSlider() {
        $('#mvaudio__volume-slider')['slider']({
            min: -5,
            max: 5,
            step: 1,
            values: [0],
            slide: (e, args) => {
                let sliderMessage = '';
                if (args.value != 0) {
                    sliderMessage += Math.abs(args.value) + ' krát ';
                    sliderMessage += (args.value > 0 ? 'hlasitější' : 'tlumenější');
                } else {
                    sliderMessage = '&nbsp;';
                }

                $('#mvaudio__volume-slider-value').html(sliderMessage);
                this.volumeSliderValue = args.value;
            }
        });
    }

    private initZoomLevels(duration) {
        if (!duration || duration < 1) {
            this.zoomLevels = [50, 100, 200, 400, 800, 1600];
            return;
        }

        this.zoomLevels = [];
        let maxZoom = Math.floor(duration * this.ZOOM_SECOND_MULTIPLIER);

        // from 100 iterates to max zoom level
        let currentZoom = 100;
        let zoomMultiplier = 1.5;

        let iteration = 0;
        let limit = 10000;

        while (currentZoom < maxZoom) {
            this.zoomLevels.push(currentZoom);
            currentZoom = Math.floor(currentZoom * zoomMultiplier);
            if (zoomMultiplier > 1.1) {
                zoomMultiplier = Math.round((zoomMultiplier - 0.05) * 100) / 100;
            }
            iteration++;
            if (iteration >= limit) {
                console.log('initZoomLevels - reach limit');
                break;
            }
        }
    }

    private updateUI() {
        this.UIHelperInstance.setDisabled('#mvaudio__btn-play');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-pause');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-seek-backward');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-seek-forward');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-zoom-in');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-zoom-out');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-add-point');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-select-all');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-remove-points');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-delete');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-change-volume');
        this.UIHelperInstance.setDisabled('#mvaudio__change-volume-slider');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-beep');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-fade-in');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-fade-out');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-undo');
        this.UIHelperInstance.setDisabled('#mvaudio__btn-save');

        let numberOfChannels = this.soundBuffer && this.soundBuffer.numberOfChannels || null;
        if (numberOfChannels) {
            // Mono
            if (numberOfChannels == 1) {
                this.UIHelperInstance.setEnabled('#mvaudio__btn-play');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-pause');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-seek-backward');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-seek-forward');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-zoom-in');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-zoom-out');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-add-point');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-select-all');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-remove-points');
                this.UIHelperInstance.setEnabled('#mvaudio__btn-save');

                let points = this.peaksInstance.points.getPoints();
                if (points && points.length >= 1) {
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-remove-points');
                } else {
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-remove-points');
                }

                if (points && points.length && points.length == 2) {
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-delete');
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-change-volume');
                    this.UIHelperInstance.setEnabled('#mvaudio__change-volume-slider');
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-beep');
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-fade-in');
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-fade-out');
                } else {
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-delete');
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-change-volume');
                    this.UIHelperInstance.setDisabled('#mvaudio__change-volume-slider');
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-beep');
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-fade-in');
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-fade-out');
                }

                if (this.soundBufferSnapshots.length > 0) {
                    this.UIHelperInstance.setEnabled('#mvaudio__btn-undo');
                } else {
                    this.UIHelperInstance.setDisabled('#mvaudio__btn-undo');
                }
                this.clearMessage();
            }
            // Stereo, Dolby, ...
            else {
                this.showMessage('Tato nahrávka není Mono (obsahuje více zvukových kanálů), tudíž ji nelze upravovat.');
            }
        }
    }

    private showMessage(msg) {
        this.msgElement.innerHTML = msg;
    }

    private clearMessage() {
        this.msgElement.innerHTML = '';
    }

    private setLoading(val) {
        val ? this.loader.show() : this.loader.hide();
    }

    private getSelectedInterval(): any {
        let points = this.peaksInstance.points.getPoints();
        let start, end;
        if (points && points.length && points.length == 2) {
            if (points[0].time < points[1].time) {
                start = points[0].time;
                end = points[1].time;
            } else {
                start = points[1].time;
                end = points[0].time;
            }

            // check start for limit's
            if (start < 0) {
                start = 0;
            } else if (start > this.duration - 1) {
                start = this.duration - 1;
            }

            // check end for limit
            if (end > this.duration) {
                end = this.duration;
            }

            return {start: start, end: end};
        }
        return false;
    }

    private updateSelection() {
        this.peaksInstance.segments.removeAll();
        let interval = this.getSelectedInterval();
        if (interval && interval.start != interval.end) {
            this.peaksInstance.segments.add({
                startTime: interval.start,
                endTime: interval.end,
                color: this.COLOR.SELECTION
            });
        }
    }

    private removeFirstPointFromCurrentSelection() {
        let points = this.peaksInstance.points.getPoints();
        if (points && points.length && points.length == 2) {
            this.peaksInstance.points.removeById(points[0].id);
        }
    }

    private zoomOut() {
        this.peaksInstance.zoom.zoomOut();
    }

    private zoomIn() {
        this.peaksInstance.zoom.zoomIn();
    }

    private seekForward() {
        this.mediaElement.currentTime = this.mediaElement.currentTime + this.SEEK_STEP;
    }

    private seekBackward() {
        this.mediaElement.currentTime = this.mediaElement.currentTime - this.SEEK_STEP;
    }

    private play() {
        this.peaksInstance.player.play();
    }

    private pause() {
        this.peaksInstance.player.pause();
    }

    private selectAll() {
        this.removePoints();

        this.peaksInstance.points.add(
            {
                time: 0,
                editable: true,
                color: this.COLOR.POINT
            },
            {
                time: Math.floor(this.peaksInstance.player.getDuration()),
                editable: true,
                color: this.COLOR.POINT
            });
        this.updateSelection();
    }

    private addPoint() {
        this.removeFirstPointFromCurrentSelection();

        this.peaksInstance.points.add({
            time: this.peaksInstance.player.getCurrentTime(),
            editable: true,
            color: this.COLOR.POINT
        });

        this.updateSelection();
    }

    private removePoints() {
        this.peaksInstance.segments.removeAll();
        this.peaksInstance.points.removeAll();
    }

    private showCanvasSnapshot() {
        return new Promise((resolve, reject) => {
            let scroll = window.scrollY;
            let el = document.querySelector(this.WAVEFORM_CONTAINER) as HTMLElement;
            html2canvas(el,
                {
                    height: el.clientHeight + scroll,
                    logging: false
                })
                .then( (canvas) => {
                    $(this.WAVEFORM_CONTAINER).css('background-image', 'url(' + canvas.toDataURL() + ')');
                    $(this.WAVEFORM_CONTAINER).css('background-position-y', -1 * (scroll));
                    resolve();
                });
        });
    }

    private hideCanvasSnapshot() {
        $(this.WAVEFORM_CONTAINER).css('background-image', 'none');
    }

    private updateCurrentAudio(newSoundBuffer, fileURL, time, isUndo, isDelete) {
        if (!isUndo) {
            this.soundBufferSnapshots.push({
                fileURL: this.mediaElement.src,
                //buffer: HelperInstance.copyAudioBuffer(soundBuffer),
                time: time
            });
            if (this.soundBufferSnapshots.length > this.UNDO_SNAPSHOTS_MAX_COUNT) {
                let removedSnapshot = this.soundBufferSnapshots.shift();
                URL.revokeObjectURL(removedSnapshot.fileURL);
            }
        }

        this.soundBuffer = newSoundBuffer;
        this.mediaElement.src = fileURL;
        let options: any = {
            initialZoom: this.peaksInstance.zoom.getZoom()
        };
        if (isDelete) {
            options.isDelete = true;
        }
        if (isUndo) {
            options.isUndo = true;
        }
        setTimeout(() => {
            this.initPeaks(time, options);
        }, 0);
    }

    private deleteSelection() {
        let interval = this.getSelectedInterval();
        if (interval) {
            this.setLoading(true);
            this.showCanvasSnapshot().then(() => {
                let interval = this.getSelectedInterval();
                if (interval) {
                    let result = this.BufferUtilsInstance.deleteInterval(this.context, this.soundBuffer, interval.start, interval.end, this.lastArrayBuffer);
                    let currentTime = this.mediaElement.currentTime;
                    if (currentTime > interval.end) {
                        currentTime -= interval.end - interval.start;
                    } else if (currentTime > interval.start && currentTime < interval.end) {
                        currentTime = interval.start;
                    }

                    this.lastStart = result.start;
                    this.lastEnd = result.end;
                    this.lastArrayBuffer = result.lastArrayBuffer;

                    this.updateCurrentAudio(result.updatedBuffer, result.fileURL, currentTime, false, true);
                }
            });
        }
    }

    private beepSelection() {
        let interval = this.getSelectedInterval();
        if (interval) {
            this.setLoading(true);
            this.showCanvasSnapshot().then(() => {
                let result = this.BufferUtilsInstance.beepInterval(this.context, this.soundBuffer, interval.start, interval.end, this.lastArrayBuffer);

                this.lastStart = result.start;
                this.lastEnd = result.end;
                this.lastArrayBuffer = result.lastArrayBuffer;

                this.updateCurrentAudio(result.updatedBuffer, result.fileURL, this.mediaElement.currentTime, false, false);
            });
        }
    }

    private fadeInSelection() {
        let interval = this.getSelectedInterval();
        if (interval) {
            this.setLoading(true);
            this.showCanvasSnapshot().then(() => {
                let result = this.BufferUtilsInstance.fadeInInterval(this.context, this.soundBuffer, interval.start, interval.end, this.lastArrayBuffer);

                this.lastStart = result.start;
                this.lastEnd = result.end;
                this.lastArrayBuffer = result.lastArrayBuffer;

                this.updateCurrentAudio(result.updatedBuffer, result.fileURL, this.mediaElement.currentTime, false, false);
            });
        }
    }

    private fadeOutSelection() {
        let interval = this.getSelectedInterval();
        if (interval) {
            this.setLoading(true);
            this.showCanvasSnapshot().then(() => {
                let result = this.BufferUtilsInstance.fadeOutInterval(this.context, this.soundBuffer, interval.start, interval.end, this.lastArrayBuffer);

                this.lastStart = result.start;
                this.lastEnd = result.end;
                this.lastArrayBuffer = result.lastArrayBuffer;

                this.updateCurrentAudio(result.updatedBuffer, result.fileURL, this.mediaElement.currentTime, false, false);
            });
        }
    }

    private changeVolumeSelection() {
        let interval = this.getSelectedInterval();
        if (interval) {
            let incrementVolumeValue = 0;
            if (this.volumeSliderValue == 0) {
                console.log('value could be different from zero');
                return;
            } else if (this.volumeSliderValue < 0) {
                incrementVolumeValue = 1 / (Math.abs(this.volumeSliderValue) + 1);
            } else if (this.volumeSliderValue > 0) {
                incrementVolumeValue = 1 * (this.volumeSliderValue + 1);
            }

            this.setLoading(true);
            this.showCanvasSnapshot().then(() => {
                let result = this.BufferUtilsInstance.changeVolumeInterval(this.context, this.soundBuffer, interval.start, interval.end, incrementVolumeValue, this.lastArrayBuffer);

                this.lastStart = result.start;
                this.lastEnd = result.end;
                this.lastArrayBuffer = result.lastArrayBuffer;

                this.updateCurrentAudio(result.updatedBuffer, result.fileURL, this.mediaElement.currentTime, false, false);
            });
        }
    }

    private undo() {
        if (this.soundBufferSnapshots.length) {
            this.setLoading(true);
            this.showCanvasSnapshot().then(() => {
                let lastChange = this.soundBufferSnapshots.pop();

                // reset time
                this.lastStart = null;
                this.lastEnd = null;

                this.updateCurrentAudio(null, lastChange.fileURL, lastChange.time, true, false);
            });
        }
    }

    private notifyChangeDuration(durationObj) {
        if (this.callbacks['change_duration']) {
            this.callbacks['change_duration'](durationObj);
        }
    }

    private save() {
        if (this.callbacks['save']) {
            this.callbacks['save']({
                fileURL: this.mediaElement.src,
                buffer: this.HelperInstance.copyAudioBuffer(this.soundBuffer),
                time: this.mediaElement.currentTime
            });
        }
    }

    on(type, cb) {
        if (this.callbacks[type]) {
            this.UIHelperInstance.warning('callback: ' + type + ' is already registered');
            return;
        }
        this.callbacks[type] = cb;
    }
};

export default AudioEditor;


