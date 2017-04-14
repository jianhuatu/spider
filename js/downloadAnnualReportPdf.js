var request = require("request");
var fs = require("fs");
var mongo = require("mongoskin");
var eventproxy = require("eventproxy");
var async = require("async");
var colors = require("colors");


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
		
		stockData = result;
		ep.emit("findStockData");
	});
}

ep.all("findStockData",function(){
	startFindUrlData()
});

function startFindUrlData(){
	ep.after("findAnnualReportPdfUrl",stockData.length,function(){
		process.exit();
	})

	findAnnualReportPdfUrl();
}

var requestStockKey = 0;

function findAnnualReportPdfUrl(){
	var thisStockData = stockData[requestStockKey];
	var stockCode = thisStockData['stockCode'];

	db.annualReportPdfUrl.find({stockCode:stockCode}).toArray(function(err,result){
		startDownPDF(result)
	});
}


function startDownPDF(data){
	ep.after("downPDF",data.length,function(){
		if(requestStockKey==stockData.length)return false;

		ep.emit("findAnnualReportPdfUrl");

		requestStockKey++;

		var time = Math.ceil(Math.random()*4)*1000;
		setTimeout(findAnnualReportPdfUrl,time);

	})
	downPDF(data.splice(0,10),data);
}

function downPDF(data,allData){
	if(!data.length)return false;

	async.mapSeries(data,function(item,callback){
		var stream = fs.createWriteStream(createPDFUrl(item));
		var requestObj = request(item.URL).pipe(stream);
		requestObj.on("close",function(){
			console.log(item.stockCode+":"+item.bulletinYear+item.bulletinType+"下载成功".green);
			ep.emit("downPDF");
			ep.emit("overdown");
		})
		requestObj.on("error",function(){
			console.log(item.stockCode+"下载错误".red);
		})
		callback(null,item);
	})

	ep.after("overdown",data.length,function(err,result){
		downPDF(allData.splice(0,10),allData);
	})
}


function createPDFUrl(data){
	if(!fs.existsSync("./annualReportPdf/"+data.stockCode)){
		fs.mkdirSync("./annualReportPdf/"+data.stockCode);
	}
	if(!fs.existsSync("./annualReportPdf/"+data.stockCode+"/"+data.bulletinYear)){
		fs.mkdirSync("./annualReportPdf/"+data.stockCode+"/"+data.bulletinYear);
	}
	return "./annualReportPdf/"+data.stockCode+"/"+data.bulletinYear+"/"+data.title+".PDF";
}

findStockData();



