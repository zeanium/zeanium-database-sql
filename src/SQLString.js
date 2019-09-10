/**
 * Created by yangyxu on 8/20/14.
 */


module.exports = zn.Class({
    static: true,
    methods: {
        __firstCharUpperCase = function (value){
            return value.replace(/\b(\w)(\w*)/g, function($0, $1, $2) {
                return $1.toUpperCase() + $2;
            });
        },
        __formatSqlValue = function (value){
            if(zn.is(value, 'string') && value!=='now()'){
                if(value.indexOf('{{') === 0 && value.indexOf('}}') === (value.length-2)){
                    value = value.substring(2, value.length - 2);
                }else {
                    value = "'" + value + "'";
                }
            }

            return value;
            //return isNaN(value) ? ("'"+value+"'") : value;
        }
    }
});
