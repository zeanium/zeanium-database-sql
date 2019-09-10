/**
 * Created by yangyxu on 9/17/14.
 */
module.exports = zn.Class({
    statics: {
        getStore: function (config) {
            return new this(config);
        }
    },
    properties: {
        config: {
            readonly: true,
            get: function (){
                return this._config;
            }
        }
    },
    methods: {
        init: {
            auto: true,
            value: function (inConfig, ConnectionPool){
                this._config = zn.extend({}, inConfig);
                this._pool = ConnectionPool.getPool(this._config);
            }
        },
        beginTransaction: function (){
            return this._pool.beginTransaction();
        },
        query: function (){
            return this._pool.query.apply(this._pool, arguments);
        },
        createDataBase: function () {
            return this._pool.createDataBase(this._config.database);
        },
        createModel: function (ModelClass) {
            return this._pool.query(ModelClass.getCreateSql());
        },
        createModels: function (models){
            var _tran = this.beginTransaction(),
                _defer = zn.async.defer(),
                _table = null,
                _model = null;
            for(var key in models){
                _model = models[key];
                _table = _model.getMeta('table');
                if (_table&&!models[_table]){
                    _tran.query(_model.getCreateSql());
                }
            }

            _tran.on('error', function (sender, err){
                _defer.reject(err);
            }).on('finally', function (sender, data){
                _defer.resolve(data);
            }).commit();

            return _defer.promise;
        }
    }
});
