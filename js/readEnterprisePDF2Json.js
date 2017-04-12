var fs = require("fs");
var PDFParser = require("pdf2json");

var pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFile("./file/data.js","module.exports = "+JSON.stringify(formatData(pdfData.formImage.Pages)));
});

pdfParser.loadPDF("./file/data.pdf");



var formatData = function(data){
	var printData = {};

	var temData = {};

	var temClassNum = 0;

	var checkClassName = false;

	for(var i=0,ilen=data.length;i<ilen;i++){
		var texts = data[i].Texts;
		for(var t=0,tlen=texts.length;t<tlen;t++){
			for(var r=0,rlen=texts[t].R.length;r<rlen;r++){
				if(!texts[t]["R"][r])continue;
				var thisData = decodeURIComponent(texts[t]["R"][r]["T"]);
				if(!thisData)continue;

				console.log(thisData);
				if(parseInt(thisData)==Number(thisData) && thisData.length<6){
					if(printData[thisData])continue;
					
					printData[thisData] = {id : thisData,className : "",stock : []};
					temClassNum = thisData;
					checkClassName = true;
				}else if(checkClassName){
					checkClassName = false;
					if(parseInt(thisData)==thisData && thisData.length==6){
						r--;
						continue;
					}
					printData[temClassNum].className = thisData;
				}else if(parseInt(thisData)==thisData && thisData.length==6){
					temData.stockCode = thisData;
				}else if(temData.stockCode){
					temData.enterpriseName = thisData;
					printData[temClassNum].stock.push(temData);
					temData = {};
				}else if(!checkClassName && (printData[temClassNum] && printData[temClassNum].className=="")){
					printData[temClassNum].className = thisData;
					checkClassName = false;
				}

			}
			
		}
	}

	return printData;
}

// process.exit()
