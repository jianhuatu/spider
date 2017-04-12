var mongo  = require("mongoskin");
var eventProxy = require("eventproxy");
var inarray = require("inarray");

var jsonData = require("../file/data.js");


var db = mongo.db("mongodb://utai:tudou6053802@localhost:27017/utai");

db.bind("stockCode");


var ep = new eventProxy();


var data = [];


function getOldStockCode(){
	var oldData = [];
	db.stockCode.find().toArray(function(err,result){

		var stockCode = [];
		for(var i=0,ilen=result.length;i<ilen;i++){
			stockCode.push(result[i]['stockCode']);
		}
		filterJsonData(stockCode);

		ep.emit("getOldStockCode");
	});
}


function filterJsonData(filterData){
	for(var k in jsonData){
		var classData = jsonData[k];
		var classId = classData.id;
		var className = classData.className;
		var stock = classData.stock;

		for(var i=0,ilen=stock.length;i<ilen;i++){
			if(inarray(filterData,stock[i].stockCode))continue;
			var insertData = {
				stockCode:stock[i].stockCode
			}

			data.push(insertData);
		}
	}

	ep.emit("filterJsonData");
}


ep.all("getOldStockCode","filterJsonData",function(){
	if(!data.length){
		console.log("没有新数据。");
		process.exit();
		return false;
	}
	db.stockCode.insert(data,function(err,result){
		if(err){
			console.log({
				code : "err",
				err : err,
				stockCode : stock[i].stockCode
			})
		}

		console.log("入库成功"+data.length+"条。");

		process.exit();
	})
});

getOldStockCode();







