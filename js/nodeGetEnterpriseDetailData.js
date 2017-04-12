var fs = require("fs")
var mongo  = require("mongoskin");
var eventProxy = require("eventproxy");
var request = require("superagent");
var charset = require("superagent-charset");
var cheerio = require("cheerio");

var db = mongo.db("mongodb://utai:tudou6053802@localhost:27017/utai");

db.bind("stockCode");
db.bind("enterpriseDetailData");


charset(request);

var ep = new eventProxy();


var stockCodeData = [];

function getStockData(){
	var checkStart = false;
	db.stockCode.find().toArray(function(err,result){
		for(var i=0,ilen=result.length;i<ilen;i++){
			// if(result[i]['stockCode'] == "002143")checkStart = true;
			// if(!checkStart)continue;
			stockCodeData.push(result[i]['stockCode']);
		}
		stockCodeData= ["603993"];
		ep.emit("getStockData")
	})
}

var enterpriseDetailData = [];

function getEnterpriseDetailData(stockCode){
	request
		.get(getCninfoURl(stockCode))
		.charset('GB2312')
		.set("Accept","text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
		.set("Referer","http://www.cninfo.com.cn/information/brief/shmb"+stockCode+".html")
		.set("User-Agent","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36")
		.end(function(err,result){
			if(!(result && result.text)){
				console.log(stockCode+"没有请求到");
				ep.emit("pushEnterpriseDetailData");
				return false;
			}
			var thisData = createEnterpriseDetailData(result.text);
			thisData.stockCode = stockCode;
			// console.log(thisData);
			enterpriseDetailData.push(thisData);

			db.enterpriseDetailData.insert(thisData,function(err,data){
				if(err){
					console.log(stockCode+"错误");
				}else{
					console.log(stockCode+"成功");
				}
				ep.emit("pushEnterpriseDetailData");
			})

		})
}


function getCninfoURl(stockCode){
	console.log(stockCode);
	switch(stockCode.slice(0,3)){
		case  "000" : return "http://www.cninfo.com.cn/information/brief/szmb"+stockCode+".html";//深市A股
		case  "001" : return "http://www.cninfo.com.cn/information/brief/szmb"+stockCode+".html";//深市A股
		case  "200" : return "http://www.cninfo.com.cn/information/brief/szmb"+stockCode+".html";//深市B股
		case  "002" : return "http://www.cninfo.com.cn/information/brief/szsme"+stockCode+".html";//深市中小板股票
		case  "300" : return "http://www.cninfo.com.cn/information/brief/szcn"+stockCode+".html";//深市创业板
		case  "600" : return "http://www.cninfo.com.cn/information/brief/shmb"+stockCode+".html";//沪市A股
		case  "601" : return "http://www.cninfo.com.cn/information/brief/shmb"+stockCode+".html";//沪市A股
		case  "603" : return "http://www.cninfo.com.cn/information/brief/shmb"+stockCode+".html";//沪市A股
		case  "900" : return "http://www.cninfo.com.cn/information/brief/shmb"+stockCode+".html";//沪市B股

	}
}

function createEnterpriseDetailData(text){
	var $ = cheerio.load(text,{decodeEntities: false});

	var table = $("table").eq(1);
	var tr = table.children("tr");

	var detailData = {};

	detailData.fullName = tr.eq(0).children("td").eq(1).text().trim().replace("&nbsp;","");//公司全称
	detailData.fullEnName = tr.eq(1).children("td").eq(1).text().trim().replace("&nbsp;","");//英文名称
	detailData.registerAddRess = tr.eq(2).children("td").eq(1).text().trim().replace("&nbsp;","");//注册地址
	detailData.name = tr.eq(3).children("td").eq(1).text().trim().replace("&nbsp;","");//公司简称
	detailData.legalPerson = tr.eq(4).children("td").eq(1).text().trim().replace("&nbsp;","");//法定代表人
	detailData.companySecretaries = tr.eq(5).children("td").eq(1).text().trim().replace("&nbsp;","");//公司董秘
	detailData.registerCapital = (Number(tr.eq(6).children("td").eq(1).text().trim().replace(/\,/g,""))*10000).toFixed(0);//注册资本
	detailData.className = tr.eq(7).children("td").eq(1).text().trim().replace("&nbsp;","");//行业种类
	detailData.zipCode = tr.eq(8).children("td").eq(1).text().trim().replace("&nbsp;","");//邮政编码
	detailData.tel = tr.eq(9).children("td").eq(1).text().trim().replace("&nbsp;","");//公司电话
	detailData.fax = tr.eq(10).children("td").eq(1).text().trim().replace("&nbsp;","");//公司传真
	detailData.url = tr.eq(11).children("td").eq(1).text().trim().replace("&nbsp;","");//公司网址
	detailData.listedDate = tr.eq(12).children("td").eq(1).text().trim().replace("&nbsp;","");//上市时间
	detailData.ipoDate = tr.eq(13).children("td").eq(1).text().trim().replace("&nbsp;","");//招股时间
	detailData.issuedNum = (Number(tr.eq(14).children("td").eq(1).text().trim().replace(/\,/g,""))*10000).toFixed(0);//发行数量
	detailData.issuedPrice = tr.eq(15).children("td").eq(1).text().trim().replace("&nbsp;","");//发行价格
	detailData.issuedPE = tr.eq(16).children("td").eq(1).text().trim().replace("&nbsp;","");//发行市盈率
	detailData.issuedType = tr.eq(17).children("td").eq(1).text().trim().replace("&nbsp;","");//发行方式
	detailData.underwriter = tr.eq(18).children("td").eq(1).text().trim().replace("&nbsp;","");//主承销商
	detailData.recommender = tr.eq(19).children("td").eq(1).text().trim().replace("&nbsp;","");//上市推荐人
	detailData.sponsor = tr.eq(20).children("td").eq(1).text().trim().replace("&nbsp;","");//保荐机构

	return detailData;
}

var spiderNum = 0;

function spiderStart(maxNum){
	var thisStockCodeData = stockCodeData[spiderNum];
	db.enterpriseDetailData.find({stockCode:thisStockCodeData}).toArray(function(err,result){
		if(err){
			console.log(sthisStockCodeData+"查询错误");
			getEnterpriseDetailData(thisStockCodeData);
		}else if(result.length==0){
			getEnterpriseDetailData(thisStockCodeData);
		}else{
			enterpriseDetailData.push(result[0]);
			console.log(thisStockCodeData+"已经入库");
		}
	})

	spiderNum++;
	if(spiderNum >=stockCodeData.length)return false;
	var time = Math.ceil(Math.random()*4)*1000;
	setTimeout(spiderStart,time)
}


ep.all("getStockData",function(){
	ep.after("pushEnterpriseDetailData",stockCodeData.length,function(){
		fs.writeFile("./file/enterpriseDetailData.js","module.exports = "+JSON.stringify(enterpriseDetailData));
		process.exit();
	});

	spiderStart();
});


getStockData();