
export class Helper {
    context;
    WAV_HEADER_SIZE;

    constructor(context) {
        this.context = context;
        this.WAV_HEADER_SIZE = 44;
    }


    copyAudioBuffer(buffer) {
        let sampleRate = buffer.sampleRate;
        let newBuffer = this.context.createBuffer(1, buffer.duration * sampleRate, sampleRate);
        newBuffer.getChannelData(0).set(buffer.getChannelData(0), 0);

        return newBuffer;
    };

    convertArrayBufferToBlob(abuffer) {
        return new Blob([abuffer], {type: "audio/wav"});
    };

    partOfbufferToWave(abuffer) {
        let numOfChan = abuffer.numberOfChannels,
            length = abuffer.length * numOfChan * 2,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        // write interleaved data
        for(let i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while(pos < length) {
            for(let i = 0; i < numOfChan; i++) {             // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
                try {
                    view.setInt16(pos, sample, true);          // write 16-bit sample
                } catch(e) {
                    // Chrome occasionally throws RangeError: Offset is outside the bounds of the DataView
                    // todo: actually fix it instead of just ignoring the error..
                }
                pos += 2;
            }
            offset++                                     // next source sample
        }

        // create buffer
        return buffer;
    };

    bufferToWave(abuffer, len) {
        let numOfChan = abuffer.numberOfChannels,
            length = len * numOfChan * 2 + this.WAV_HEADER_SIZE,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"

        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit (hardcoded in this demo)

        setUint32(0x61746164);                         // "data" - chunk
        setUint32(length - pos - 4);                   // chunk length

        // write interleaved data
        for(let i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while(pos < length) {
            for(let i = 0; i < numOfChan; i++) {             // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
                try {
                    view.setInt16(pos, sample, true);          // write 16-bit sample
                } catch(e) {
                    // Chrome occasionally throws RangeError: Offset is outside the bounds of the DataView
                    // todo: actually fix it instead of just ignoring the error..
                }
                pos += 2;
            }
            offset++                                     // next source sample
        }

        return buffer;

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    };

    float32Concat(first, second) {
        let firstLength = first.length;
        let result = new Float32Array(firstLength + second.length);
        result.set(first);
        result.set(second, firstLength);

        return result;
    };

    float32Copy(originalArray){
        let result = new Float32Array(originalArray.length);
        result.set(originalArray);
        return result;
    };

    arrayBufferConcat(first, second) {
        let tmp = new Uint8Array(first.byteLength + second.byteLength);
        tmp.set(new Uint8Array(first), 0);
        tmp.set(new Uint8Array(second), first.byteLength);
        return tmp.buffer;
    };

    extractDelta(e: any){
        if(e.originalEvent.deltaY) {
            return e.originalEvent.deltaY;
        }

        if (e.wheelDelta) {
            return e.wheelDelta;
        }

        if (e.originalEvent.detail) {
            return e.originalEvent.detail * 40;
        }

        if (e.originalEvent && e.originalEvent.wheelDelta) {
            return e.originalEvent.wheelDelta;
        }

        return 0;
    }

    // get formatted time from duration (which is double in seconds)
    getFormattedDuration(duration) {
        let hours = Math.floor((duration / 3600) % 60);
        let minutes = Math.floor((duration / 60)  % 60);
        let seconds = Math.round(duration % 60);

        let formatted = [
            hours,
            hours > 0 && minutes < 10 ? '0' + minutes : minutes,
            seconds < 10 ? '0' + seconds : seconds
        ].filter(Boolean).join(':');

        return {
            duration: duration,
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            formatted: formatted
        }
    }
}
