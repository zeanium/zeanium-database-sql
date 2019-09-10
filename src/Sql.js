/**
 * Created by yangyxu on 8/20/14.
 */
var __slice = Array.prototype.slice;
var SQLS = {
    insert: "insert into {table} {values};",
    update: "update {table} set {updates} {where};",
    delete: "delete from {table} {where};",
    select : "select {fields} from {table} {where} {order} {group} {limit};",
    paging: "select {fields} from {table} {where} {order} {group} {limit};select count(*) as count from {table} {where};"
};

var SchemaSqlParser = require('./schema/SchemaSqlParser');

module.exports = zn.Class({
    static: true,
    methods: {
        paging: function (){
            return __slice.call(arguments).map(function (data){
                var _index = data.pageIndex || 1,
                    _size = data.pageSize || 10,
                    _start = (_index - 1) * _size,
                    _end = _index * _size;

                data.limit = [_start, _size];
                return this.__format(SQLS.paging, data);
            }.bind(this)).join('');
        },
        select: function (){
            return this.format(SQLS.select, arguments);
        },
        insert: function (){
            return this.format(SQLS.insert, arguments);
        },
        update: function (){
            return this.format(SQLS.update, arguments);
        },
        delete: function (){
            return this.format(SQLS.delete, arguments);
        },
        format: function (sql, argv){
            var _argv = [];
            switch (zn.type(argv)) {
                case 'array':
                    _argv = argv;
                    break;
                case 'object':
                    return this.__format(sql, argv);
                case 'arguments':
                    _argv = __slice.call(argv);
                    break;
            }

            return _argv.map(function (data){
                return this.__format(sql, data);
            }.bind(this)).join('');
        },
        __format: function (sql, data){
            var _data = zn.overwrite({ }, data);
            _data.fields = _data.fields || '*';
            return sql.format(SchemaSqlParser.parse(_data)).replace(/\s+/g, ' ');
            //return sql.format(SchemaSqlParser.parse(data)).replace(/\s+/g, ' ').replace(/(^s*)|(s*$)/g, '');
        }
    }
});
