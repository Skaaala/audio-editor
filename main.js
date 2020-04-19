var startTime, endTime;
function _start() {
    startTime = new Date();
}

function _end(name) {
    endTime = new Date();
    var diff = endTime - startTime;
    var msg = 'interval ' + name + ' takes: ' + (endTime - startTime) + ' ms';
    if(diff > 1000){
        console.log('%c' + msg, 'color: #ff0000');
    } else {
        console.log(msg);
    }
}

$(document).ready(function() {
    var audio_file = document.querySelector('#mvaudio__input_file');
    var mediaElement = document.querySelector('#mvaudio__audio-element');

    audio_file.onchange = function() {
        document.querySelector('#mvaudio__loader').style.display = 'block';

        var file = this.files[0];
        var reader = new FileReader();
        reader.onload = function() {
            var editor = new AudioEditor(mediaElement.duration);

            editor.on('change_duration', function(data){
                console.log('on change duration');
                console.log(data);
            });

            editor.on('save', function(data){
                console.log('on save');
                console.log(data);
            });

            // Peaks.js use the same decodeAudioData function which is expensive
            /*var context = new(window.AudioContext || window.webkitAudioContext)();
                context.decodeAudioData(reader.result, function(buffer) {
                _end('decodeAudioData');
                //buffer: AudioBuffer
                console.log(buffer);
                var editor = new AudioEditor(buffer);

                editor.on('save', function(data){
                    console.log('on save');
                    console.log(data);
                });
            });*/
        };
        reader.readAsArrayBuffer(file);
        var blob = window.URL || window.webkitURL;
        var fileURL = blob.createObjectURL(file);
        mediaElement.src = fileURL;
    };
});
