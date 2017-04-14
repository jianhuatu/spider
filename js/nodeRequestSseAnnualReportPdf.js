var request = require("request");
var mongo = require("mongoskin");
var eventproxy = require("eventproxy");



var db = mongo.db("mongodb://utai:tudou6053802@localhost:27017/utai");

db.bind("enterpriseDetailData");
db.bind("annualReportPdfUrl");


var ep = new eventproxy();

var stockData = [];

function findStockData(){
	db.enterpriseDetailData.find({stockCode:{$regex:/^(600|601|603|900)/}},{stockCode:1,listedDate:1}).toArray(function(err,result){
		if(err){
			console.log("查询错误");
			return false;
		}

		stockData = result;
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
	var options = createRequestOptions(stockCode,date);
	request(options,function(err,response,body){
		if(err || !body){
			console.log(stockCode+"当前日期("+options.qs.beginDate+"到"+options.qs.endDate+")没有抓取到数据");
			ep.emit("requestPdfData");
			return false;
		}

		var dataString = body.replace(options.qs.jsonCallBack+"(","").replace(/\)$/,"");
		var data = JSON.parse(dataString)
		if(data.result.length==0){
			console.log(stockCode+"当前日期("+options.qs.beginDate+"到"+options.qs.endDate+")没有数据");
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
					URL : "http://www.sse.com.cn"+data.result[i].URL,
					SSEDate : data.result[i].SSEDate,
					reportType : "year"
				})

			}

			db.annualReportPdfUrl.insert(urlData,function(err,result){
				if(err){
					console.log(stockCode+"当前日期"+options.qs.beginDate+"到"+options.qs.endDate+"插入错误");
				}else{
					console.log(stockCode+"当前日期"+options.qs.beginDate+"到"+options.qs.endDate+"插入成功");
				}
				ep.emit("requestPdfData");
				return false;
			})
		}
	})
}


function createRequestOptions(stockCode,date){
	return {
		url : "http://query.sse.com.cn/security/stock/queryCompanyStatementNew.do",
		qs : {
			jsonCallBack : "jsonpCallback"+Math.ceil(Math.random()*100000),
			isPagination : "true",
			productId : stockCode,
			keyWord : "",
			isNew : "1",
			reportType2 : "DQBG",
			reportType : "YEARLY",
			beginDate : date[0],
			endDate : date[1],
			pageHelp : {
				pageSize : 25,
				pageCount : 50,
				pageNo : 1,
				beginPage : 1,
				cacheSize : 1,
				endPage : 5
			},
			_:new Date().getTime()
		},
		headers : {
			"Accept" :"*/*",
			"Accept-Encoding" : "gzip, deflate, sdch",
			"Accept-Language" : "zh-CN,zh;q=0.8",
			"Connection" : "keep-alive",
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
			"Host" : "query.sse.com.cn",
        	'Referer' : 'http://www.sse.com.cn/disclosure/listedinfo/announcement/',
        	'cookie' : "yfx_c_g_u_id_10000042=_ck17040115004012358501073498263; yfx_f_l_v_t_10000042=f_t_1491030040223__r_t_1491795345863__v_t_1491815656522__r_c_2; websearch=%22600108%22%3A%22%u4E9A%u76DB%u96C6%u56E2%22; VISITED_MENU=%5B%228351%22%2C%228464%22%2C%228528%22%2C%228466%22%2C%229055%22%2C%228705%22%2C%228451%22%2C%228312%22%2C%228349%22%2C%229062%22%2C%228307%22%5D; VISITED_STOCK_CODE=%5B%22600200%22%2C%22600000%22%2C%22600419%22%2C%22600015%22%2C%22600727%22%2C%22600097%22%2C%22600108%22%2C%22600107%22%5D; VISITED_COMPANY_CODE=%5B%22600200%22%2C%22600000%22%2C%22600419%22%2C%22600015%22%2C%22600727%22%2C%22600097%22%2C%22600108%22%2C%22%5Bobject%20Object%5D%22%2C%22600107%22%5D; seecookie=%5B600200%5D%3A%u6C5F%u82CF%u5434%u4E2D%2C300581%2C%5B600000%5D%3A%u6D66%u53D1%u94F6%u884C%2C%5B600015%5D%3A%u534E%u590F%u94F6%u884C%2C%5B600727%5D%3A%u9C81%u5317%u5316%u5DE5%2C%5B600097%5D%3A%u5F00%u521B%u56FD%u9645%2C%5B600108%5D%3A%u4E9A%u76DB%u96C6%u56E2%2C%u5E74%u62A5%2C%5B600107%5D%3A%u7F8E%u5C14%u96C5"
		}
	}
}


findStockData();



