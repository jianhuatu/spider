var request = require("superagent");
var charset = require("superagent-charset");
var mongo = require("mongoskin");
var eventproxy = require("eventproxy");
var cheerio = require("cheerio");



var db = mongo.db("mongodb://utai:tudou6053802@localhost:27017/utai");

db.bind("enterpriseDetailData");
db.bind("annualReportPdfUrl");

charset(request);


var ep = new eventproxy();

var stockData = [];

function findStockData(){
	db.enterpriseDetailData.find({stockCode:{$regex:/^(000|001|200|002|300)/}},{stockCode:1,listedDate:1}).toArray(function(err,result){
		if(err){
			console.log("查询错误");
			return false;
		}

		var checkPush = false;
		for(var i=0,ilen=result.length;i<ilen;i++){
			if(result[i]['stockCode']=="000090")checkPush=true;
			if(!checkPush)continue;
			stockData.push(result[i]);
			// break;
		}

		// stockData = result;
		ep.emit("findStockData");
	});
}

ep.all("findStockData",function(){
	startRequestUrlData()
});


function startRequestUrlData(){
	ep.after("requestUrlData",stockData.length,function(){
		process.exit();
	})

	requestUrlData();
}

function createDateArr(date){
	var listedTime = new Date(date);
	var nowTime = new Date();

	var listedYear = listedTime.getFullYear();
	var nowYear = nowTime.getFullYear();

	var dateArr = [];
	for(var start=listedYear;start<nowYear;start++){
		var startDate = [start,"01","01"];
		var endDate = [start,"12","31"]
		dateArr.push([startDate.join("-"),endDate.join("-")]);
	}

	return dateArr;
}

var requestStockKey = 0;

function requestUrlData(){
	var thisStockData = stockData[requestStockKey];
	var stockCode = thisStockData['stockCode'];
	var listedDate = thisStockData['listedDate'];

	var dateArr = createDateArr(listedDate);


	ep.after("requestPdfData",dateArr.length,function(){
		if(requestStockKey==stockData.length)return false;

		ep.emit("requestUrlData");

		requestStockKey++;

		var time = Math.ceil(Math.random()*4)*1000;
		setTimeout(requestUrlData,time);
	})



	for(var i=0,ilen=dateArr.length;i<ilen;i++){
		setTimeout(function(){
			requestPdfData(stockCode,dateArr[this.i]);
		}.bind({i:i}),Math.ceil(Math.random()*i)*1000);
	}
}


function requestPdfData(stockCode,date){
	var sendData = ctreatSendjData(stockCode,date)
	request
		.post("http://disclosure.szse.cn/m/search0425.jsp")
		.charset('GB2312')
		.send(sendData)
		.set("Accept","text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
		.set("Accept-Encoding","gzip, deflate")
		.set("Accept-Language","zh-CN,zh;q=0.8")
		.set("Cache-Control","max-age=0")
		.set("Connection","keep-alive")
		.set("Content-Type","application/x-www-form-urlencoded")
		.set("Cookie","JSESSIONID=BA01C8635FAB645670D0A38885433877")
		.set("Host","disclosure.szse.cn")
		.set("Origin","http://disclosure.szse.cn")
		.set("Referer","http://disclosure.szse.cn/m/search0425.jsp")
		.set("User-Agent","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36")
		.end(function(err,result){
			if(err || !result){
				console.log(stockCode+"当前日期("+sendData.startTime+"到"+sendData.endTime+")没有抓取到数据");
				ep.emit("requestPdfData");
				return false;
			}
			if(!(result && result.text)){
				console.log(stockCode+"当前日期("+sendData.startTime+"到"+sendData.endTime+")没有请求到");
				ep.emit("requestPdfData");
				return false;
			}

			// console.log(date);

			var $ = cheerio.load(result.text,{decodeEntities: false});
			var data = createPdfData(stockCode,$,sendData.startTime,sendData.endTime);
			// console.log(data);
			// return false;

			if(data.result.length==0){
				console.log(stockCode+"当前日期("+sendData.startTime+"到"+sendData.endTime+")没有数据");
				ep.emit("requestPdfData");
				return false;
			}else{
				var urlData = [];
				for(var i=0,ilen=data.result.length;i<ilen;i++){
					urlData.push({
						title : data.result[i].title,
						stockCode : data.result[i]["security_Code"],
						bulletinType : data.result[i]["bulletin_Type"],
						bulletinYear : data.result[i]["bulletin_Year"],
						URL : data.result[i].URL,
						SSEDate : data.result[i].SSEDate,
						reportType : "year"
					})
				}

				db.annualReportPdfUrl.insert(urlData,function(err,result){
					if(err){
						console.log(stockCode+"当前日期"+sendData.startTime+"到"+sendData.endTime+"插入错误");
					}else{
						console.log(stockCode+"当前日期"+sendData.startTime+"到"+sendData.endTime+"插入成功");
					}
					ep.emit("requestPdfData");
					return false;
				})
			}
		})
}

function createPdfData(stockCode,$,startTime,endTime){
	var tableObj = $("table[align='right']");
	var trObj =tableObj.find("tr");
	var data = {result:[]};

	if(trObj.length<2){
		var tdObj = trObj.eq(0).children("td");
		if(tdObj.length<2 && tdObj.text().indexOf("没有找到你搜索的公告")>-1){
			return data;
		}
	}


	for(var i=0,ilen=trObj.length;i<ilen;i++){
		var tdObj = trObj.eq(i).children("td").eq(1);
		var aObj = tdObj.find("a");
		var spanObj = tdObj.find("span");
		var aText = aObj.text();
		// console.log(aText);
		if(aText.indexOf("：")>-1){
			var aTextArr = aText.split("：");
			var aTextYear = aTextArr[1].split("年");
		}else if(/[一二三四五六七八九零][O0零一二三四五六七八九]{2}[一二三四五六七八九零]/g.test(aText)){
			var year = /[一二三四五六七八九零][O0零一二三四五六七八九]{2}[一二三四五六七八九零]/g.exec(aText)[0];

			year = year.replace(/一/g,1);
			year = year.replace(/二/g,2);
			year = year.replace(/三/g,3);
			year = year.replace(/四/g,4);
			year = year.replace(/五/g,5);
			year = year.replace(/六/g,6);
			year = year.replace(/七/g,7);
			year = year.replace(/八/g,8);
			year = year.replace(/九/g,9);
			year = year.replace(/零/g,0);
			year = year.replace(/\O/g,"O");

			var aTextArr = aText.split(/[一二三四五六七八九零][]{2}[一二三四五六七八九零]/g);
			aTextArr[1] = year+aTextArr[1];
			var aTextYear = aTextArr[1].split("年");
		}else if(aText.indexOf("204年年")>-1){
			var year = "2004";
			var aTextArr = aText.split("204");
			aTextArr[1] = year+aTextArr[1];
			var aTextYear = aTextArr[1].split("年");
		}else{
			var year = /\d{4}/g.exec(aText);
			if(!year){
				var yearArr = /\d{1}OO\d{1}/g.exec(aText);
				if(!yearArr){
					console.log(stockCode+"当前日期"+startTime+"到"+endTime+"没有年份数据");
					return data;
				}
				year = yearArr[0];
				year.replace("OO","00")
				var aTextArr = aText.split(/\d{1}OO\d{1}/g);
			}else{
				var aTextArr = aText.split(/\d{4}/g);
			}
			aTextArr[1] = year+aTextArr[1];
			var aTextYear = aTextArr[1].split("年");
		}
		

		data.result.push({
			bulletin_Type : getBulletinType(aTextYear[aTextYear.length-1]),
			bulletin_Year : aTextYear[0],
			security_Code : stockCode,
			title : aTextArr[0]+"年"+aTextYear[2],
			URL : "http://disclosure.szse.cn/"+aObj.attr("href"),
			SSEDate : spanObj.text().replace(/(^\[|\]$)/g,""),
			security_Code : stockCode
		})
	}
	return data;
}


function getBulletinType(str){
	if(str.indexOf("摘要")>-1){
		return "年报摘要"
	}else if(str.indexOf("补充")>-1){
		return "年报补充公告";
	}else if(str.indexOf("更正")>-1){
		return "年报更正公告"
	}else {
		return "年报"
	}
}


function ctreatSendjData(stockCode,date){
	return {
		leftid : 1,
		lmid : "drgg",
		pageNo : 1,
		stockCode : stockCode,
		keyword : "",
		noticeType : "010301",
		startTime : date[0],
		endTime : date[1],
		imageField : {
			x : Math.ceil(Math.random()*68),
			y : Math.ceil(Math.random()*22)
		},
		tzy: ""
	}
}


findStockData();



