var request = require("request");
var fs = require("fs");
var mongo = require("mongoskin");
var eventproxy = require("eventproxy");

var ep = new eventproxy();

var db = mongo.db("mongodb://utai:tudou6053802@localhost:27017/utai");

db.bind("stockCode");
db.bind("annualReportPdfUrl");

var stockData = [];

function findStockData(){
	db.stockCode.find().toArray(function(err,result){
		if(err){
			console.log("查询错误");
			return false;
		}

		//var checkPush = false;
		// for(var i=0,ilen=result.length;i<ilen;i++){
		// 	if(result[i]['stockCode']=="000830")checkPush=true;
		// 	if(!checkPush)continue;
		// 	stockData.push(result[i]);
		// }
		
		stockData = result;
		ep.emit("findStockData");
	});
}

ep.all("findStockData",function(){
	startDownPdf()
});

function startDownPdf(){
	ep.after("requestUrlData",stockData.length,function(){
		process.exit();
	})

	requestUrlData();
}


// var stream = fs.createWriteStream("./annualReportPdf/000637.PDF");
// request("http://disclosure.szse.cn/finalpage/2014-04-25/63917745.PDF").pipe(stream).on("close",function(){
// 	console.log(111);
// })