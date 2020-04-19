declare var $;

export class UiHelper {
    DISABLED_BTN_CLASS;
    CONSOLE_PREFIX;

    constructor() {
        this.DISABLED_BTN_CLASS = 'mvaudio__btn-disabled';
        this.CONSOLE_PREFIX = 'Audio Editor :: ';
    }

    setDisabled(selector){
        $(selector).addClass(this.DISABLED_BTN_CLASS);
    };

    setEnabled(selector) {
        $(selector).removeClass(this.DISABLED_BTN_CLASS);
    };

    bindOnMousePressed(elem, callback) {
        let interval;
        let doJobCounter = 0;

        $(elem).bind('mousedown', () => {
            doJobCounter = 0;
            interval = setInterval(doJob, 30);
        });

        $(elem).bind('mouseup',  () => {
            if(doJobCounter === 0){
                callback();
            }
            clearInterval(interval);
        });

        function doJob()
        {
            doJobCounter++;
            callback();
        }
    };

    private printToConsole(type, text) {
        console[type](this.CONSOLE_PREFIX + text);
    }

    log(text) {
        this.printToConsole('log', text);
    };

    warning(text) {
        this.printToConsole('warn', text);
    };

    error(text) {
        this.printToConsole('error', text);
    };

}
