import {Helper} from './helper';

export class BufferUtils {
    context;
    HelperInstance;
    blob;

    constructor(context) {
        this.context = context;
        this.HelperInstance = new Helper(context);
        this.blob = window.URL || window.webkitURL;
    }

    updateLastBufferWithNew(context, lastArrayBuffer, newAudioBuffer, start, end, sampleRate) {
        // set interval length
        let interval = Math.floor(end - start);

        // splice original buffer from 0 to start * 2 (16-bit sample = 2 * 8-bit) + size of header
        let bufferStart = lastArrayBuffer.slice(0, (start * 2) + this.HelperInstance.WAV_HEADER_SIZE);

        // splice original buffer end * 2 (16-bit sample = 2 * 8-bit) + size of header to last item
        let bufferEnd = lastArrayBuffer.slice((end * 2) + this.HelperInstance.WAV_HEADER_SIZE, lastArrayBuffer.byteLength);

        // create buffer for only updated part
        let bufferUpdatedPart = context.createBuffer(1, interval, sampleRate);

        // get all channel data
        //let channelData = Helpers.float32Copy(newAudioBuffer.getChannelData(0));
        let channelData = newAudioBuffer.getChannelData(0);

        // get only updated channel data (interval)
        let partOfChannelData = channelData.slice(start, end);

        // set created buffer data as updated channel data
        bufferUpdatedPart.copyToChannel(partOfChannelData, 0, 0);

        // create Wav for updated part of data
        let updatedPart = this.HelperInstance.partOfbufferToWave( bufferUpdatedPart );

        // concat buffer start + updated part + buffer end and return it
        return this.HelperInstance.arrayBufferConcat(this.HelperInstance.arrayBufferConcat(bufferStart, updatedPart), bufferEnd);
    }

    deleteInterval(context, buffer, start, end, lastArrayBuffer) {
        let sampleRate = buffer.sampleRate;
        let realStart = Math.floor(start * sampleRate);
        let realEnd = Math.floor(end * sampleRate);
        let splitSize = realEnd - realStart;

        let myAudioBuffer = context.createBuffer(1, (buffer.length - splitSize), sampleRate);

        let channelData = buffer.getChannelData(0);
        let splitedArray = this.HelperInstance.float32Concat(
            channelData.slice(0, realStart),
            channelData.slice(realEnd, buffer.length));

        myAudioBuffer.copyToChannel(splitedArray, 0, 0);

        let newArrayBuffer = this.HelperInstance.arrayBufferConcat(
            lastArrayBuffer.slice(0, (realStart * 2) + this.HelperInstance.WAV_HEADER_SIZE),                            // 0 to start
            lastArrayBuffer.slice((realEnd * 2) + this.HelperInstance.WAV_HEADER_SIZE, lastArrayBuffer.byteLength));    // end to last

        let fileUrl = this.blob.createObjectURL(
            this.HelperInstance.convertArrayBufferToBlob(newArrayBuffer)
        );

        return {
            start: realStart,
            end: realEnd,
            lastArrayBuffer: newArrayBuffer,
            fileURL: fileUrl,
            updatedBuffer: myAudioBuffer
        };
    };

    beepInterval(context, buffer, start, end, lastArrayBuffer){
        let sampleRate = buffer.sampleRate;
        let realStart = Math.floor(start * sampleRate);
        let realEnd = Math.floor(end * sampleRate);
        let myAudioBuffer = buffer;
        let channelData = buffer.getChannelData(0);


        let value = 0;
        let step = 0.002;
        let max = 0.02;
        let min = -1 * max;

        for (let i = realStart; i < realEnd; i++) {
            if(value >= max || value <= min){
                step = -1 * step;
            }
            value += step;
            channelData[i] = value;
        }

        myAudioBuffer.copyToChannel(channelData, 0, 0);

        let newArrayBuffer = this.updateLastBufferWithNew(context, lastArrayBuffer, myAudioBuffer, realStart, realEnd, sampleRate);

        let fileUrl = this.blob.createObjectURL(
            this.HelperInstance.convertArrayBufferToBlob(newArrayBuffer)
        );

        return {
            start: realStart,
            end: realEnd,
            lastArrayBuffer: newArrayBuffer,
            fileURL: fileUrl,
            updatedBuffer: myAudioBuffer
        };
    };

    fadeInInterval(context, buffer, start, end, lastArrayBuffer){
        let sampleRate = buffer.sampleRate;
        let realStart = Math.floor(start * sampleRate);
        let realEnd = Math.floor(end * sampleRate);
        let myAudioBuffer = buffer;
        let channelData = buffer.getChannelData(0);


        let iteration = 0;
        let step = 1 / Math.ceil(realEnd - realStart);

        for (let i = realStart; i < realEnd; i++) {
            iteration++;
            channelData[i] = channelData[i] * (iteration * step);
        }

        myAudioBuffer.copyToChannel(channelData, 0, 0);

        let newArrayBuffer = this.updateLastBufferWithNew(context, lastArrayBuffer, myAudioBuffer, realStart, realEnd, sampleRate);

        let fileUrl = this.blob.createObjectURL(
            this.HelperInstance.convertArrayBufferToBlob(newArrayBuffer)
        );

        return {
            start: realStart,
            end: realEnd,
            lastArrayBuffer: newArrayBuffer,
            fileURL: fileUrl,
            updatedBuffer: myAudioBuffer
        };
    };

    fadeOutInterval(context, buffer, start, end, lastArrayBuffer){
        let sampleRate = buffer.sampleRate;
        let realStart = Math.floor(start * sampleRate);
        let realEnd = Math.floor(end * sampleRate);
        let myAudioBuffer = buffer;
        let channelData = buffer.getChannelData(0);


        let iteration = 0;
        let step = 1 / Math.ceil(realEnd - realStart);

        for (let i = realEnd; i > realStart; i--) {
            iteration++;
            channelData[i] = channelData[i] * (iteration * step);
        }

        myAudioBuffer.copyToChannel(channelData, 0, 0);

        let newArrayBuffer = this.updateLastBufferWithNew(context, lastArrayBuffer, myAudioBuffer, realStart, realEnd, sampleRate);

        let fileUrl = this.blob.createObjectURL(
            this.HelperInstance.convertArrayBufferToBlob(newArrayBuffer)
        );

        return {
            start: realStart,
            end: realEnd,
            lastArrayBuffer: newArrayBuffer,
            fileURL: fileUrl,
            updatedBuffer: myAudioBuffer
        };
    };

    changeVolumeInterval(context, buffer, start, end, incrementVolume, lastArrayBuffer){
        let sampleRate = buffer.sampleRate;
        let realStart = Math.floor(start * sampleRate);
        let realEnd = Math.floor(end * sampleRate);
        let myAudioBuffer = buffer;
        let channelData = buffer.getChannelData(0);

        for (let i = realStart; i < realEnd; i++) {
            channelData[i] = channelData[i] * incrementVolume;
        }

        myAudioBuffer.copyToChannel(channelData, 0, 0);

        let newArrayBuffer = this.updateLastBufferWithNew(context, lastArrayBuffer, myAudioBuffer, realStart, realEnd, sampleRate);

        let fileUrl = this.blob.createObjectURL(
            this.HelperInstance.convertArrayBufferToBlob(newArrayBuffer)
        );

        return {
            start: realStart,
            end: realEnd,
            lastArrayBuffer: newArrayBuffer,
            fileURL: fileUrl,
            updatedBuffer: myAudioBuffer
        };
    }
}
