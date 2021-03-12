module.exports = {
    string : function (input, power = 1) {
        var output = '';

        input = input.toString();

        if (parseInt(input) < (10 ** power)) {
            let leading = '';

            for(i = 0; i < power; i++) {
                leading = leading.concat('0');
            }

            input = leading + input;
        }

        return input;
    }
};
