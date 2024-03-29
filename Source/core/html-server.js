/*
 * @project: TERA
 * @version: Development (beta)
 * @license: MIT (not for evil)
 * @copyright: Yuriy Ivanov (Vtools) 2017-2019 [progr76@gmail.com]
 * Web: https://terafoundation.org
 * Twitter: https://twitter.com/terafoundation
 * Telegram:  https://t.me/terafoundation
*/

"use strict";
require("./crypto-library");
require("./log.js");
const crypto = require('crypto');
const os = require('os');
var BlockTree = new STreeBuffer(300 * 1000, CompareItemHashSimple, "number");
const http = require('http'), net = require('net'), url = require('url'), fs = require('fs'), querystring = require('querystring');
var ContenTypeMap = {};
ContenTypeMap["js"] = "application/javascript";
ContenTypeMap["css"] = "text/css";
ContenTypeMap["wav"] = "audio/wav";
ContenTypeMap["mp3"] = "audio/mpeg";
ContenTypeMap["mp4"] = "video/mp4";
ContenTypeMap["ico"] = "image/vnd.microsoft.icon";
ContenTypeMap["jpg"] = "image/jpeg";
ContenTypeMap["png"] = "image/png";
ContenTypeMap["gif"] = "image/gif";
ContenTypeMap["html"] = "text/html";
ContenTypeMap["txt"] = "text/plain";
ContenTypeMap["csv"] = "text/csv";
ContenTypeMap["svg"] = "image/svg+xml";
ContenTypeMap["zip"] = "application/zip";
ContenTypeMap["pdf"] = "application/pdf";
ContenTypeMap["exe"] = "application/octet-stream";
ContenTypeMap["msi"] = "application/octet-stream";
ContenTypeMap["woff"] = "application/font-woff";
ContenTypeMap["psd"] = "application/octet-stream";
var DefaultContentType = "application/octet-stream";
var CacheMap = {};
CacheMap["sha3.js"] = 1000000;
CacheMap["sign-lib-min.js"] = 1000000;
CacheMap["marked.js"] = 1000000;
CacheMap["highlight.js"] = 1000000;
CacheMap["highlight-html.js"] = 1000000;
CacheMap["highlight-js.js"] = 1000000;
if(!global.WebApi2)
    global.WebApi2 = {};
global.HTTPCaller = {};
function DoCommand(response,Type,Path,params,remoteAddress)
{
    var Caller = HTTPCaller;
    var Method = params[0];
    var Path2 = Path;
    if(Path2.substring(0, 1) === "/")
        Path2 = Path2.substring(1);
    var ArrPath = Path2.split('/', 5);
    var APIv2 = 0;
    if(ArrPath[0] === "api")
    {
        if(ArrPath[1] === "v2")
        {
            APIv2 = 1;
            Caller = WebApi2;
        }
        Method = ArrPath[2];
    }
    var F = Caller[Method];
    if(F)
    {
        if(Type !== "POST")
        {
            response.end();
            return ;
        }
        response.writeHead(200, {'Content-Type':'text/plain'});
        var Ret = F(params[1], response);
        if(Ret === null)
            return ;
        try
        {
            var Str = JSON.stringify(Ret);
            response.end(Str);
        }
        catch(e)
        {
            ToLog("ERR PATH:" + Path);
            ToLog(e);
            response.end();
        }
        return ;
    }
    var method = params[0];
    method = method.toLowerCase();
    if(method === "dapp" && params.length === 2)
        method = "DappTemplateFile";
    var LongTime = undefined;
    switch(method)
    {
        case "":
            SendWebFile(response, "./HTML/wallet.html");
            break;
        case "file":
            SendBlockFile(response, params[1], params[2]);
            break;
        case "DappTemplateFile":
            DappTemplateFile(response, params[1]);
            break;
        case "smart":
            DappSmartCodeFile(response, params[1]);
            break;
        case "client":
            DappClientCodeFile(response, params[1]);
            break;
        case "tx":
            DoGetTransactionByID(response, {TxID:params[1]});
            break;
        default:
            {
                if(Path.indexOf(".") ===  - 1)
                    ToError("Error path:" + Path + "  remoteAddress=" + remoteAddress);
                var path = params[params.length - 1];
                if(typeof path !== "string")
                    path = "ErrorPath";
                else
                    if(Path.indexOf("..") >= 0 || path.indexOf("\\") >= 0 || path.indexOf("/") >= 0)
                        path = "ErrorFilePath";
                if(path.indexOf(".") < 0)
                    path += ".html";
                var type = Path.substr(Path.length - 3, 3);
                switch(type)
                {
                    case ".js":
                        if(params[0] === "HTML" && params[1] === "Ace")
                        {
                            LongTime = 1000000;
                            path = Path;
                        }
                        else
                            if(params[0] === "Ace")
                            {
                                LongTime = 1000000;
                                path = "./HTML/" + Path;
                            }
                            else
                            {
                                path = "./HTML/JS/" + path;
                            }
                        break;
                    case "css":
                        path = "./HTML/CSS/" + path;
                        break;
                    case "wav":
                    case "mp3":
                        path = "./HTML/SOUND/" + path;
                        break;
                    case "svg":
                    case "png":
                    case "gif":
                    case "jpg":
                    case "ico":
                        path = "./HTML/PIC/" + path;
                        break;
                    case "pdf":
                    case "zip":
                    case "exe":
                    case "msi":
                        path = "./HTML/FILES/" + path;
                        break;
                    default:
                        path = "./HTML/" + path;
                        break;
                }
                SendWebFile(response, path, "", 0, LongTime);
                break;
            }
    }
}
global.DappTemplateFile = DappTemplateFile;
function DappTemplateFile(response,StrNum)
{
    var Num = parseInt(StrNum);
    if(Num && Num <= DApps.Smart.GetMaxNum())
    {
        var Data = DApps.Smart.ReadSmart(Num);
        if(Data)
        {
            response.writeHead(200, {'Content-Type':'text/html', "X-Frame-Options":"sameorigin"});
            var Str = fs.readFileSync("HTML/dapp-frame.html", {encoding:"utf8"});
            Str = Str.replace(/#template-number#/g, Num);
            Str = Str.replace(/.\/tera.ico/g, "/file/" + Data.IconBlockNum + "/" + Data.IconTrNum);
            response.end(Str);
            return ;
        }
    }
    response.writeHead(404, {'Content-Type':'text/html'});
    response.end();
}
global.DappSmartCodeFile = DappSmartCodeFile;
function DappSmartCodeFile(response,StrNum)
{
    var Num = parseInt(StrNum);
    if(Num && Num <= DApps.Smart.GetMaxNum())
    {
        var Data = DApps.Smart.ReadSmart(Num);
        if(Data)
        {
            response.writeHead(200, {'Content-Type':'application/javascript', "Access-Control-Allow-Origin":"*"});
            response.end(Data.Code);
            return ;
        }
    }
    response.writeHead(404, {'Content-Type':'text/html'});
    response.end();
}
global.DappClientCodeFile = DappClientCodeFile;
function DappClientCodeFile(response,StrNum)
{
    var Num = parseInt(StrNum);
    if(Num && Num <= DApps.Smart.GetMaxNum())
    {
        var Data = DApps.Smart.ReadSmart(Num);
        if(Data)
        {
            response.writeHead(200, {'Content-Type':"text/plain", "X-Content-Type-Options":"nosniff"});
            response.end(Data.HTML);
            return ;
        }
    }
    response.writeHead(404, {'Content-Type':'text/html'});
    response.end();
}
HTTPCaller.DappSmartHTMLFile = function (Params)
{
    var Data = DApps.Smart.ReadSmart(ParseNum(Params.Smart));
    if(Data)
    {
        if(global.DEV_MODE && Params.DebugPath)
        {
            ToLog("Load: " + Params.DebugPath);
            Data.HTML = fs.readFileSync(Params.DebugPath, {encoding:"utf8"});
        }
        return {result:1, Body:Data.HTML};
    }
    return {result:0};
}
global.SendBlockFile = SendBlockFile;
function SendBlockFile(response,BlockNum,TrNum)
{
    BlockNum = parseInt(BlockNum);
    TrNum = parseInt(TrNum);
    if(BlockNum && BlockNum <= SERVER.GetMaxNumBlockDB() && TrNum <= MAX_TRANSACTION_COUNT)
    {
        var Block = SERVER.ReadBlockDB(BlockNum);
        if(Block && Block.arrContent)
        {
            SendToResponceFile(response, Block, TrNum);
            return ;
        }
        else
            if(!Block || !Block.TrDataPos)
            {
                LoadBlockFromNetwork({BlockNum:BlockNum}, function (Err,Block)
                {
                    if(Err)
                    {
                        SendToResponce404(response);
                    }
                    else
                    {
                        SendToResponceFile(response, Block, TrNum);
                    }
                });
                return ;
            }
    }
    SendToResponce404(response);
}
function SendToResponceFile(response,Block,TrNum)
{
    var Body = Block.arrContent[TrNum];
    if(Body && Body.data)
        Body = Body.data;
    if(Body && Body[0] === global.TYPE_TRANSACTION_FILE)
    {
        var TR = DApps.File.GetObjectTransaction(Body);
        if(TR.ContentType.toLowerCase().indexOf("html") >= 0)
            response.writeHead(200, {'Content-Type':"text/plain", "X-Content-Type-Options":"nosniff"});
        else
            response.writeHead(200, {'Content-Type':TR.ContentType, "X-Content-Type-Options":"nosniff"});
        response.end(TR.Data);
    }
    else
    {
        SendToResponce404(response);
    }
}
function SendToResponce404(response)
{
    response.writeHead(404, {'Content-Type':'text/html'});
    response.end();
}
HTTPCaller.DappBlockFile = function (Params,response)
{
    Params.BlockNum = ParseNum(Params.BlockNum);
    Params.TrNum = ParseNum(Params.TrNum);
    if(!Params.TrNum)
        Params.TrNum = 0;
    if(Params.BlockNum && Params.BlockNum <= SERVER.GetMaxNumBlockDB() && Params.TrNum <= MAX_TRANSACTION_COUNT)
    {
        var Block = SERVER.ReadBlockDB(Params.BlockNum);
        if(Block && Block.arrContent)
        {
            SendToResponceDappFile(response, Block, Params.TrNum);
            return null;
        }
        else
            if(!Block || !Block.TrDataPos)
            {
                LoadBlockFromNetwork(Params, function (Err,Block)
                {
                    if(Err)
                    {
                        SendToResponceResult0(response);
                    }
                    else
                    {
                        SendToResponceDappFile(response, Block, Params.TrNum);
                    }
                });
                return null;
            }
    }
    return {result:0};
}
function SendToResponceDappFile(response,Block,TrNum)
{
    var Result = {result:0};
    var Body = Block.arrContent[TrNum];
    if(Body)
    {
        var Type = Body[0];
        if(Type === global.TYPE_TRANSACTION_FILE)
        {
            var TR = DApps.File.GetObjectTransaction(Body);
            Result = {result:1, Type:Type, ContentType:TR.ContentType, Name:TR.Name, Body:TR.Data.toString('utf8')};
        }
        else
        {
            var App = DAppByType[Type];
            if(App)
            {
                Body = JSON.parse(App.GetScriptTransaction(Body));
            }
            Result = {result:1, Type:Type, Body:Body};
        }
    }
    var Str = JSON.stringify(Result);
    response.end(Str);
}
function SendToResponceResult0(response)
{
    if(response)
        response.end("{\"result\":0}");
}
var glBlock0;
HTTPCaller.DappStaticCall = function (Params,response)
{
    var Result = RunStaticSmartMethod(ParseNum(Params.Account), Params.MethodName, Params.Params);
    var Str = JSON.stringify(Result);
    if(Str.length > 16000)
    {
        return {result:0, RetValue:"Error result length (more 16000)"};
    }
    response.end(Str);
    return null;
    DApps.Accounts.BeginBlock();
    DApps.Accounts.BeginTransaction();
    global.TickCounter = 100000;
    var Account = DApps.Accounts.ReadStateTR(ParseNum(Params.Account));
    if(!Account)
    {
        return {result:0, RetValue:"Error account Num: " + Params.Account};
    }
    if(!glBlock0)
        glBlock0 = SERVER.ReadBlockHeaderDB(0);
    var RetValue;
    try
    {
        var BlockNum = GetCurrentBlockNumByTime();
        RetValue = RunSmartMethod(glBlock0, Account.Value.Smart, Account, BlockNum, 0, undefined, Params.MethodName, Params.Params,
        1);
    }
    catch(e)
    {
        return {result:0, RetValue:"" + e};
    }
    var Str = JSON.stringify({result:1, RetValue:RetValue});
    if(Str.length > 16000)
    {
        return {result:0, RetValue:"Error result length (more 16000)"};
    }
    response.end(Str);
    return null;
}
HTTPCaller.DappInfo = function (Params,responce,ObjectOnly)
{
    var SmartNum = ParseNum(Params.Smart);
    if(global.TX_PROCESS && global.TX_PROCESS.Worker)
        global.TX_PROCESS.Worker.send({cmd:"SetSmartEvent", Smart:SmartNum});
    var Account;
    var Smart = DApps.Smart.ReadSimple(SmartNum);
    if(Smart)
    {
        delete Smart.HTML;
        delete Smart.Code;
        Account = DApps.Accounts.ReadState(Smart.Account);
        try
        {
            Account.SmartState = BufLib.GetObjectFromBuffer(Account.Value.Data, Smart.StateFormat, {});
            if(typeof Account.SmartState === "object")
                Account.SmartState.Num = Account.Num;
        }
        catch(e)
        {
            if(!Account)
                Account = {};
            Account.SmartState = {};
        }
    }
    DeleteOldEvents(SmartNum);
    var Context = GetUserContext(Params);
    var EArr = GetEventArray(SmartNum, Context);
    var WLData = HTTPCaller.DappWalletList(Params);
    var ArrLog = [];
    for(var i = 0; i < ArrLogClient.length; i++)
    {
        var Item = ArrLogClient[i];
        if(!Item.final)
            continue;
        ArrLog.push(Item);
    }
    var Ret = {result:1, DELTA_CURRENT_TIME:DELTA_CURRENT_TIME, MIN_POWER_POW_TR:MIN_POWER_POW_TR, FIRST_TIME_BLOCK:FIRST_TIME_BLOCK,
        CONSENSUS_PERIOD_TIME:CONSENSUS_PERIOD_TIME, PRICE_DAO:PRICE_DAO(SERVER.BlockNumDB), NEW_SIGN_TIME:NEW_SIGN_TIME, Smart:Smart,
        Account:Account, NETWORK:global.NETWORK, ArrWallet:WLData.arr, ArrEvent:EArr, ArrLog:ArrLog, };
    if(global.WALLET)
    {
        Ret.WalletIsOpen = (WALLET.WalletOpen !== false);
        Ret.WalletCanSign = (WALLET.WalletOpen !== false && WALLET.KeyPair.WasInit);
        Ret.PubKey = WALLET.KeyPair.PubKeyStr;
    }
    if(!ObjectOnly)
    {
        Ret.CurTime = Date.now();
        Ret.CurBlockNum = GetCurrentBlockNumByTime();
        Ret.MaxAccID = DApps.Accounts.GetMaxAccount();
        Ret.MaxDappsID = DApps.Smart.GetMaxNum();
    }
    return Ret;
}
HTTPCaller.DappWalletList = function (Params)
{
    var arr0 = DApps.Accounts.GetWalletAccountsByMap(WALLET.AccountMap);
    var arr = [];
    for(var i = 0; i < arr0.length; i++)
    {
        if(Params.AllAccounts || arr0[i].Value.Smart === Params.Smart)
        {
            arr.push(arr0[i]);
        }
    }
    var Ret = {result:1, arr:arr, };
    return Ret;
}
HTTPCaller.DappAccountList = function (Params)
{
    var arr = DApps.Accounts.GetRowsAccounts(Params.StartNum, Params.CountNum, undefined, 1);
    return {arr:arr, result:1};
}
HTTPCaller.DappSmartList = function (Params)
{
    var arr = DApps.Smart.GetRows(Params.StartNum, Params.CountNum, undefined, undefined, Params.GetAllData, Params.TokenGenerate);
    return {arr:arr, result:1};
}
HTTPCaller.DappBlockList = function (Params,response)
{
    Params.Filter = undefined;
    return HTTPCaller.GetBlockList(Params, response, 1);
}
HTTPCaller.DappTransactionList = function (Params,response)
{
    Params.Filter = undefined;
    Params.Param3 = Params.BlockNum;
    return HTTPCaller.GetTransactionAll(Params, response);
}
var sessionid = GetHexFromAddres(crypto.randomBytes(20));
HTTPCaller.RestartNode = function (Params)
{
    global.RestartNode();
    return {result:1};
}
HTTPCaller.ToLogServer = function (Str)
{
    ToLogClient(Str);
    return {result:1};
}
HTTPCaller.FindMyAccounts = function (Params)
{
    WALLET.FindMyAccounts(1);
    return {result:1};
}
HTTPCaller.GetAccount = function (id)
{
    id = parseInt(id);
    var arr = DApps.Accounts.GetRowsAccounts(id, 1);
    return {Item:arr[0], result:1};
}
HTTPCaller.GetAccountList = function (Params)
{
    if(!Params.CountNum)
        Params.CountNum = 1;
    var arr = DApps.Accounts.GetRowsAccounts(Params.StartNum, Params.CountNum, Params.Filter);
    return {arr:arr, result:1};
}
HTTPCaller.GetDappList = function (Params)
{
    if(!Params.CountNum)
        Params.CountNum = 1;
    var arr = DApps.Smart.GetRows(Params.StartNum, Params.CountNum, Params.Filter, Params.Filter2, 1);
    return {arr:arr, result:1};
}
HTTPCaller.GetBlockList = function (Params,response,bOnlyNum)
{
    if(!Params.CountNum)
        Params.CountNum = 1;
    if(Params.StartNum < SERVER.BlockNumDBMin)
    {
        let CountWait = 0;
        var WasWait = 0;
        for(var BlockNum = Params.StartNum; BlockNum < Params.StartNum + Params.CountNum; BlockNum++)
        {
            var Block = SERVER.ReadBlockHeaderDB(BlockNum);
            if(!Block)
            {
                CountWait++;
                WasWait = 1;
                LoadBlockFromNetwork({BlockNum:BlockNum}, function (Err,Block)
                {
                    CountWait--;
                    if(CountWait === 0)
                    {
                        var arr = SERVER.GetRows(Params.StartNum, Params.CountNum, Params.Filter);
                        var Result = {arr:arr, result:1};
                        response.end(JSON.stringify(Result));
                    }
                });
            }
        }
        if(WasWait)
            return null;
    }
    var arr = SERVER.GetRows(Params.StartNum, Params.CountNum, Params.Filter, !bOnlyNum);
    return {arr:arr, result:1};
}
HTTPCaller.GetTransactionAll = function (Params,response)
{
    if(!Params.CountNum)
        Params.CountNum = 1;
    var BlockNum = Params.Param3;
    if(BlockNum < SERVER.BlockNumDBMin)
    {
        var Block = SERVER.ReadBlockHeaderDB(BlockNum);
        if(!Block)
        {
            LoadBlockFromNetwork({BlockNum:BlockNum}, function (Err,Block)
            {
                var Result;
                if(Err)
                {
                    Result = {arr:[], result:0};
                }
                else
                {
                    var arr = SERVER.GetTrRows(Block.BlockNum, Params.StartNum, Params.CountNum, Params.Filter);
                    Result = {arr:arr, result:1};
                }
                var Str = JSON.stringify(Result);
                response.end(Str);
            });
            return null;
        }
    }
    var arr = SERVER.GetTrRows(BlockNum, Params.StartNum, Params.CountNum, Params.Filter);
    return {arr:arr, result:1};
}
HTTPCaller.GetActList = function (Params)
{
    var arr = DApps.Accounts.GetActList(Params.StartNum, Params.CountNum, Params.Filter);
    return {arr:arr, result:1};
}
HTTPCaller.GetHashList = function (Params)
{
    var arr = DApps.Accounts.DBAccountsHash.GetRows(Params.StartNum, Params.CountNum, Params.Filter);
    for(var i = 0; i < arr.length; i++)
    {
        var item = arr[i];
        item.BlockNum = item.Num * PERIOD_ACCOUNT_HASH;
        item.Hash100 = [];
        if(item.BlockNum % 100 === 0)
        {
            var Data = SERVER.DBHeader100.Read(item.BlockNum / 100);
            if(Data)
                item.Hash100 = Data.Hash100;
        }
    }
    return {arr:arr, result:1};
}
HTTPCaller.GetHistoryAct = function (Params)
{
    var arr = WALLET.GetHistory(Params.StartNum, Params.CountNum, Params.Filter);
    return {arr:arr, result:1};
}
var LastTimeGetHashRate = 0;
var LastHashRate = 0;
var HashRateOneSec = 0;
HTTPCaller.GetWalletInfo = function (Params)
{
    var Constants = {};
    for(var i = 0; i < global.CONST_NAME_ARR.length; i++)
    {
        var key = global.CONST_NAME_ARR[i];
        Constants[key] = global[key];
    }
    var MaxHistory = 0;
    var Delta = Date.now() - LastTimeGetHashRate;
    if(Delta >= 1000)
    {
        if(Delta < 1100)
            HashRateOneSec = global.HASH_RATE - LastHashRate;
        LastHashRate = global.HASH_RATE;
        LastTimeGetHashRate = Date.now();
    }
    var StateTX = DApps.Accounts.DBStateTX.Read(0);
    var TXBlockNum = 0;
    if(StateTX)
        TXBlockNum = StateTX.BlockNum;
    var Ret = {result:1, WalletOpen:WALLET.WalletOpen, WalletIsOpen:(WALLET.WalletOpen !== false), WalletCanSign:(WALLET.WalletOpen !== false && WALLET.KeyPair.WasInit),
        CODE_VERSION:CODE_VERSION, MAX_TRANSACTION_LIMIT:MAX_TRANSACTION_LIMIT, PROTOCOL_VER:PROTOCOL_VER, PROTOCOL_MODE:PROTOCOL_MODE,
        MAX_LEVEL:MAX_LEVEL, VersionNum:global.UPDATE_CODE_VERSION_NUM, RelayMode:SERVER.RelayMode, BlockNumDB:SERVER.BlockNumDB, CurBlockNum:GetCurrentBlockNumByTime(),
        CurTime:Date.now(), IsDevelopAccount:IsDeveloperAccount(WALLET.PubKeyArr), AccountMap:WALLET.AccountMap, ArrLog:ArrLogClient,
        MaxAccID:DApps.Accounts.GetMaxAccount(), MaxActNum:DApps.Accounts.GetActsMaxNum(), MaxDappsID:DApps.Smart.GetMaxNum(), NeedRestart:global.NeedRestart,
        ip:SERVER.ip, port:SERVER.port, NET_WORK_MODE:global.NET_WORK_MODE, INTERNET_IP_FROM_STUN:global.INTERNET_IP_FROM_STUN, HistoryMaxNum:MaxHistory,
        DELTA_CURRENT_TIME:DELTA_CURRENT_TIME, FIRST_TIME_BLOCK:FIRST_TIME_BLOCK, CONSENSUS_PERIOD_TIME:CONSENSUS_PERIOD_TIME, NEW_SIGN_TIME:NEW_SIGN_TIME,
        DATA_PATH:(DATA_PATH.substr(1, 1) === ":" ? DATA_PATH : GetNormalPathString(process.cwd() + "/" + DATA_PATH)), NodeAddrStr:SERVER.addrStr,
        STAT_MODE:global.STAT_MODE, HTTPPort:global.HTTP_PORT_NUMBER, HTTPPassword:HTTP_PORT_PASSWORD, CONSTANTS:Constants, CheckPointBlockNum:CHECK_POINT.BlockNum,
        MiningAccount:global.GENERATE_BLOCK_ACCOUNT, CountMiningCPU:GetCountMiningCPU(), CountRunCPU:global.ArrMiningWrk.length, MiningPaused:global.MiningPaused,
        HashRate:HashRateOneSec, MIN_POWER_POW_TR:MIN_POWER_POW_TR, PRICE_DAO:PRICE_DAO(SERVER.BlockNumDB), NWMODE:global.NWMODE, PERIOD_ACCOUNT_HASH:PERIOD_ACCOUNT_HASH,
        MAX_ACCOUNT_HASH:DApps.Accounts.DBAccountsHash.GetMaxNum(), TXBlockNum:TXBlockNum, SpeedSignLib:global.SpeedSignLib, NETWORK:global.NETWORK,
    };
    if(Params.Account)
        Ret.PrivateKey = GetHexFromArr(WALLET.GetPrivateKey(WALLET.AccountMap[Params.Account]));
    else
        Ret.PrivateKey = GetHexFromArr(WALLET.GetPrivateKey());
    Ret.PublicKey = WALLET.KeyPair.PubKeyStr;
    return Ret;
}
HTTPCaller.GetCurrentInfo = HTTPCaller.GetWalletInfo;
HTTPCaller.TestSignLib = function ()
{
    global.TestSignLib();
}
HTTPCaller.GetWalletAccounts = function ()
{
    var Ret = {result:1, arr:DApps.Accounts.GetWalletAccountsByMap(WALLET.AccountMap), };
    Ret.PrivateKey = WALLET.KeyPair.PrivKeyStr;
    Ret.PublicKey = WALLET.KeyPair.PubKeyStr;
    return Ret;
}
HTTPCaller.SetWalletKey = function (PrivateKeyStr)
{
    WALLET.SetPrivateKey(PrivateKeyStr, true);
    return {result:1};
}
HTTPCaller.SetWalletPasswordNew = function (Password)
{
    WALLET.SetPasswordNew(Password);
    return {result:1};
}
HTTPCaller.OpenWallet = function (Password)
{
    var res = WALLET.OpenWallet(Password);
    return {result:res};
}
HTTPCaller.CloseWallet = function ()
{
    var res = WALLET.CloseWallet();
    return {result:res};
}
HTTPCaller.GetSignTransaction = function (TR)
{
    var Sign = WALLET.GetSignTransaction(TR);
    return {Sign:Sign, result:1};
}
HTTPCaller.GetSignFromHEX = function (Params)
{
    var Arr = GetArrFromHex(Params.Hex);
    var Sign;
    if(Params.Account)
        Sign = WALLET.GetSignFromArr(Arr, WALLET.AccountMap[Params.Account]);
    else
        Sign = WALLET.GetSignFromArr(Arr);
    return {Sign:Sign, result:1};
}
HTTPCaller.SendTransactionHex = function (Params)
{
    var body = GetArrFromHex(Params.Hex);
    var Result = {result:1};
    var Res = SERVER.AddTransactionOwn({body:body, ToAll:1});
    Result.sessionid = sessionid;
    Result.text = AddTrMap[Res];
    var final = false;
    if(Res <= 0 && Res !==  - 3)
        final = true;
    ToLogClient("Send: " + Result.text, GetHexFromArr(sha3(body)), final);
    return Result;
}
HTTPCaller.SendDirectCode = function (Params,response)
{
    var Result;
    if(Params.TX || Params.WEB || Params.ST)
    {
        var RunProcess;
        if(Params.TX)
            RunProcess = global.TX_PROCESS;
        if(Params.WEB)
            RunProcess = global.WEB_PROCESS;
        if(Params.ST)
            RunProcess = global.STATIC_PROCESS;
        if(RunProcess && RunProcess.RunRPC)
        {
            RunProcess.RunRPC("EvalCode", Params.Code, function (Err,Ret)
            {
                Result = {result:!Err, sessionid:sessionid, text:Ret, };
                var Str = JSON.stringify(Result);
                response.end(Str);
            });
            return null;
        }
        else
        {
            Result = "No process for send call";
        }
    }
    else
    {
        try
        {
            var ret = eval(Params.Code);
            Result = JSON.stringify(ret, "", 4);
        }
        catch(e)
        {
            Result = "" + e;
        }
    }
    var Struct = {result:1, sessionid:sessionid, text:Result};
    return Struct;
}
HTTPCaller.SetMining = function (MiningAccount)
{
    WALLET.SetMiningAccount(parseInt(MiningAccount));
    return {result:1};
}
function CheckCorrectDevKey()
{
    if(WALLET.WalletOpen === false)
    {
        var StrErr = "Not open wallet";
        ToLogClient(StrErr);
        return {result:0, text:StrErr};
    }
    if(!IsDeveloperAccount(WALLET.PubKeyArr))
    {
        var StrErr = "Not developer key";
        ToLogClient(StrErr);
        return {result:0, text:StrErr};
    }
    return true;
}
HTTPCaller.SendECode = function (Param)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    if(Param.All)
    {
        SERVER.ConnectToAll();
        var arr = SERVER.GetActualNodes();
        for(var i = 0; i < arr.length; i++)
        {
            var Node = arr[i];
            SERVER.SendECode(Param, Node);
        }
        return {result:1, text:"Sent to " + arr.length + " nodes"};
    }
    var Node = FindNodeByAddr(Param.Addr, 1);
    if(Node === undefined)
        return {result:0, text:"Node not found"};
    if(Node === false)
        return {result:0, text:"Node not active - reconnect"};
    SERVER.SendECode(Param, Node);
    return {result:1, text:"Send"};
}
HTTPCaller.SetCheckPoint = function (BlockNum)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    if(!BlockNum)
        BlockNum = SERVER.BlockNumDB;
    else
        BlockNum = parseInt(BlockNum);
    if(SetCheckPointOnBlock(BlockNum))
        return {result:1, text:"Set check point on BlockNum=" + BlockNum};
    else
        return {result:0, text:"Error on check point BlockNum=" + BlockNum};
}
function SetCheckPointOnBlock(BlockNum)
{
    if(WALLET.WalletOpen === false)
        return 0;
    var Block = SERVER.ReadBlockHeaderDB(BlockNum);
    if(!Block)
        return 0;
    var SignArr = arr2(Block.Hash, GetArrFromValue(Block.BlockNum));
    var Sign = secp256k1.sign(SHA3BUF(SignArr, Block.BlockNum), WALLET.KeyPair.getPrivateKey('')).signature;
    global.CHECK_POINT = {BlockNum:BlockNum, Hash:Block.Hash, Sign:Sign};
    SERVER.ResetNextPingAllNode();
    return 1;
}
global.SetCheckPointOnBlock = SetCheckPointOnBlock;
var idSetTimeSetCheckPoint;
HTTPCaller.SetAutoCheckPoint = function (Param)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    if(idSetTimeSetCheckPoint)
        clearInterval(idSetTimeSetCheckPoint);
    idSetTimeSetCheckPoint = undefined;
    if(Param.Set)
        idSetTimeSetCheckPoint = setInterval(RunSetCheckPoint, Param.Period * 1000);
    return {result:1, text:"AutoCheck: " + Param.Set + " each " + Param.Period + " sec"};
}
var SumCheckPow = 0;
var CountCheckPow = 0;
function RunSetCheckPoint()
{
    if(!SERVER.BlockNumDB)
        return ;
    if(SERVER.BlockNumDB < 2100000)
        return ;
    var Delta = GetCurrentBlockNumByTime() - SERVER.BlockNumDB;
    if(Delta > 16)
        return ;
    var BlockNum = SERVER.BlockNumDB - global.CheckPointDelta;
    var Block = SERVER.ReadBlockHeaderDB(BlockNum);
    if(Block)
    {
        var Power = GetPowPower(Block.PowHash);
        if(Power < 30)
        {
            ToLog("CANNOT SET CHECK POINT Power=" + Power + "  BlockNum=" + BlockNum);
            return ;
        }
        CountCheckPow++;
        SumCheckPow += Power;
        var AvgPow = SumCheckPow / CountCheckPow;
        if(CountCheckPow > 10)
        {
            if(Power < AvgPow - 2)
            {
                ToLog("**************** CANNOT SET CHECK POINT Power=" + Power + "/" + AvgPow + "  BlockNum=" + BlockNum);
                return ;
            }
        }
        SetCheckPointOnBlock(BlockNum);
        ToLog("SET CHECK POINT Power=" + Power + "/" + AvgPow + "  BlockNum=" + BlockNum);
    }
}
HTTPCaller.SetNewCodeVersion = function (Data)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    var Ret = SERVER.SetNewCodeVersion(Data, WALLET.KeyPair.getPrivateKey(''));
    SERVER.ResetNextPingAllNode();
    return {result:1, text:Ret};
}
HTTPCaller.SetCheckNetConstant = function (Data)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    if(!Data)
    {
        ToLogClient("Data not set");
        return {result:0, text:"Data not set"};
    }
    Data.Num = GetCurrentBlockNumByTime();
    Data.BlockNum = GetCurrentBlockNumByTime() + 10;
    var SignArr = SERVER.GetSignCheckNetConstant(Data);
    Data.Sign = secp256k1.sign(SHA3BUF(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
    SERVER.CheckNetConstant({NetConstant:Data}, {addrStr:"local"});
    SERVER.ResetNextPingAllNode();
    return {result:1, text:"Set NET_CONSTANT BlockNum=" + Data.BlockNum};
}
HTTPCaller.SetCheckDeltaTime = function (Data)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    if(!Data || !Data.Num)
    {
        ToLogClient("Num not set");
        return {result:0};
    }
    var SignArr = SERVER.GetSignCheckDeltaTime(Data);
    Data.Sign = secp256k1.sign(SHA3BUF(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
    global.CHECK_DELTA_TIME = Data;
    SERVER.ResetNextPingAllNode();
    return {result:1, text:"Set check time Num=" + Data.Num};
}
var idAutoCorrTime;
HTTPCaller.SetAutoCorrTime = function (bSet)
{
    var Ret = CheckCorrectDevKey();
    if(Ret !== true)
        return Ret;
    if(idAutoCorrTime)
        clearInterval(idAutoCorrTime);
    idAutoCorrTime = undefined;
    if(bSet)
        idAutoCorrTime = setInterval(RunAutoCorrTime, 1000);
    return {result:1, text:"Auto correct: " + bSet};
}
var StartCheckTimeNum = 0;
function RunAutoCorrTime()
{
    if(WALLET.WalletOpen === false)
        return ;
    if(GetCurrentBlockNumByTime() > StartCheckTimeNum && Math.abs(global.DELTA_CURRENT_TIME) >= 120)
    {
        var AutoDelta =  - Math.trunc(global.DELTA_CURRENT_TIME);
        var Data = {Num:GetCurrentBlockNumByTime(), bUse:1, bAddTime:1};
        if(AutoDelta < 0)
        {
            AutoDelta =  - AutoDelta;
            Data.bAddTime = 0;
        }
        Data.DeltaTime = 40;
        Data.StartBlockNum = Data.Num + 5;
        Data.EndBlockNum = Data.StartBlockNum + Math.trunc(AutoDelta / Data.DeltaTime);
        var SignArr = SERVER.GetSignCheckDeltaTime(Data);
        Data.Sign = secp256k1.sign(SHA3BUF(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
        global.CHECK_DELTA_TIME = Data;
        SERVER.ResetNextPingAllNode();
        StartCheckTimeNum = Data.EndBlockNum + 1;
        ToLog("Auto corr time Num:" + Data.Num + " AutoDelta=" + AutoDelta);
    }
}
HTTPCaller.SaveConstant = function (SetObj)
{
    var WasUpdate = global.USE_AUTO_UPDATE;
    for(var key in SetObj)
    {
        global[key] = SetObj[key];
    }
    SAVE_CONST(true);
    SERVER.DO_CONSTANT();
    WALLET.FindMyAccounts(1);
    if(!WasUpdate && global.USE_AUTO_UPDATE && CODE_VERSION.VersionNum && global.UPDATE_CODE_VERSION_NUM < CODE_VERSION.VersionNum)
    {
        SERVER.UseCode(CODE_VERSION.VersionNum, true);
    }
    if(SetObj.DoRestartNode)
        global.RestartNode();
    else
    {
        if(SetObj.DoMining)
            global.RunStopPOWProcess();
    }
    return {result:1};
}
HTTPCaller.SetHTTPParams = function (SetObj)
{
    global.HTTP_PORT_NUMBER = SetObj.HTTPPort;
    global.HTTP_PORT_PASSWORD = SetObj.HTTPPassword;
    SAVE_CONST(true);
    if(SetObj.DoRestartNode)
        global.RestartNode();
    return {result:1};
}
HTTPCaller.SetNetMode = function (SetObj)
{
    if(!global.NET_WORK_MODE)
        global.NET_WORK_MODE = {};
    for(var key in SetObj)
    {
        global.NET_WORK_MODE[key] = SetObj[key];
    }
    if(NET_WORK_MODE)
    {
        global.START_IP = NET_WORK_MODE.ip;
        global.START_PORT_NUMBER = NET_WORK_MODE.port;
    }
    SAVE_CONST(true);
    if(SetObj.DoRestartNode)
        global.RestartNode();
    return {result:1};
}
HTTPCaller.GetAccountKey = function (Num)
{
    var Result = {};
    Result.result = 0;
    var KeyPair = WALLET.GetAccountKey(Num);
    if(KeyPair)
    {
        Result.result = 1;
        Result.PubKeyStr = GetHexFromArr(KeyPair.getPublicKey('', 'compressed'));
    }
    return Result;
}
HTTPCaller.GetHotArray = function (Param)
{
    var ArrTree = SERVER.GetTransferTree();
    if(!ArrTree)
        return {result:0};
    for(var Level = 0; Level < ArrTree.length; Level++)
    {
        var arr = ArrTree[Level];
        if(arr)
            for(var n = 0; n < arr.length; n++)
            {
                arr[n].GetTiming = 0;
            }
    }
    var BlockCounts = 0;
    if(Param && Param.CountBlock)
        for(var i = SERVER.CurrentBlockNum - Param.CountBlock; i <= SERVER.CurrentBlockNum - Param.CountBlock; i++)
        {
            var Block = SERVER.GetBlock(i);
            if(!Block || !Block.Active || !Block.LevelsTransfer)
            {
                continue;
            }
            BlockCounts++;
            for(var n = 0; n < Block.LevelsTransfer.length; n++)
            {
                var Transfer = Block.LevelsTransfer[n];
                for(var Addr in Transfer.TransferNodes)
                {
                    var Item = Transfer.TransferNodes[Addr];
                    Item.Node.GetTiming += Item.GetTiming;
                }
            }
        }
    for(var Level = 0; Level < ArrTree.length; Level++)
    {
        var arr = ArrTree[Level];
        if(!arr)
            continue;
        arr.sort(SortNodeHot);
        for(var n = 0; n < arr.length; n++)
        {
            arr[n] = GetCopyNode(arr[n], BlockCounts);
        }
    }
    function SortNodeHot(a,b)
    {
        if(b.Hot !== a.Hot)
            return b.Hot - a.Hot;
        if(b.BlockProcessCount !== a.BlockProcessCount)
            return b.BlockProcessCount - a.BlockProcessCount;
        if(a.DeltaTime !== b.DeltaTime)
            return a.DeltaTime - b.DeltaTime;
        return a.id - b.id;
    };
    return {result:1, ArrTree:ArrTree};
}
function GetCopyNode(Node,BlockCounts)
{
    if(!Node)
        return ;
    if(Node.Socket && Node.Socket.Info)
    {
        Node.Info += Node.Socket.Info + "\n";
        Node.Socket.Info = "";
    }
    if(!Node.PrevInfo)
        Node.PrevInfo = "";
    var GetTiming = 0;
    if(BlockCounts !== 0)
        GetTiming = Math.trunc(Node.GetTiming / BlockCounts) / 1000;
    var Item = {VersionNum:Node.VersionNum, LevelsBit:Node.LevelsBit, NoSendTx:Node.NoSendTx, GetNoSendTx:Node.GetNoSendTx, DirectMAccount:Node.DirectMAccount,
        id:Node.id, ip:Node.ip, portweb:Node.portweb, port:Node.port, TransferCount:Node.TransferCount, GetTiming:GetTiming, ErrCountAll:Node.ErrCountAll,
        LevelCount:Node.LevelCount, LevelEnum:Node.LevelEnum, TimeTransfer:GetStrOnlyTimeUTC(new Date(Node.LastTimeTransfer)), BlockProcessCount:Node.BlockProcessCount,
        DeltaTime:Node.DeltaTime, DeltaTimeM:Node.DeltaTimeM, DeltaGlobTime:Node.DeltaGlobTime, PingNumber:Node.PingNumber, NextConnectDelta:Node.NextConnectDelta,
        NextGetNodesDelta:Node.NextGetNodesDelta, NextHotDelta:Node.NextHotDelta, Name:Node.Name, addrStr:Node.addrStr, CanHot:Node.CanHot,
        Active:Node.Active, Hot:Node.Hot, Info:Node.PrevInfo + Node.Info, InConnectArr:Node.WasAddToConnect, Level:Node.Level, TransferBlockNum:Node.TransferBlockNum,
        TransferSize:Node.TransferSize, TransferBlockNumFix:Node.TransferBlockNumFix, CurBlockNum:Node.CurBlockNum, };
    return Item;
}
HTTPCaller.GetBlockchainStat = function (Param)
{
    var Result = SERVER.GetStatBlockchainPeriod(Param);
    Result.result = 1;
    Result.sessionid = sessionid;
    return Result;
}
HTTPCaller.GetAllCounters = function (Params,response)
{
    let Result = GET_STATS();
    Result.result = 1;
    Result.sessionid = sessionid;
    Result.STAT_MODE = global.STAT_MODE;
    if(!global.TX_PROCESS || !global.TX_PROCESS.RunRPC)
        return Result;
    global.TX_PROCESS.RunRPC("GET_STATS", "", function (Err,Params)
    {
        Result.result = !Err;
        if(Result.result)
        {
            AddStatData(Params, Result, "TX");
        }
        if(global.WEB_PROCESS && global.WEB_PROCESS.RunRPC)
        {
            global.WEB_PROCESS.RunRPC("GET_STATS", "", function (Err,Params)
            {
                Result.result = !Err;
                if(Result.result)
                {
                    AddStatData(Params, Result, "WEB");
                }
                response.end(JSON.stringify(Result));
            });
        }
        else
        {
            response.end(JSON.stringify(Result));
        }
    });
    return null;
}
function AddStatData(Params,Result,Prefix)
{
    for(var name in Params.stats)
    {
        for(var key in Params.stats[name])
        {
            var Item = Params.stats[name][key];
            Result.stats[name][key + "-" + Prefix] = Item;
        }
    }
}
HTTPCaller.SetStatMode = function (flag)
{
    if(flag)
        StartCommonStat();
    global.STAT_MODE = flag;
    SAVE_CONST(true);
    global.TX_PROCESS.RunRPC("LOAD_CONST");
    return {result:1, sessionid:sessionid, STAT_MODE:global.STAT_MODE};
}
HTTPCaller.ClearStat = function ()
{
    global.ClearCommonStat();
    if(global.TX_PROCESS && global.TX_PROCESS.RunRPC)
    {
        global.TX_PROCESS.RunRPC("ClearCommonStat", "", function (Err,Params)
        {
        });
    }
    if(global.WEB_PROCESS && global.WEB_PROCESS.RunRPC)
    {
        global.WEB_PROCESS.RunRPC("ClearCommonStat", "", function (Err,Params)
        {
        });
    }
    return {result:1, sessionid:sessionid, STAT_MODE:global.STAT_MODE};
}
HTTPCaller.RewriteAllTransactions = function (Param)
{
    RewriteAllTransactions();
    return {result:1, sessionid:sessionid};
}
HTTPCaller.RewriteTransactions = function (Param)
{
    var Ret = SERVER.ReWriteDAppTransactions(Param.BlockCount);
    return {result:Ret, sessionid:sessionid};
}
HTTPCaller.TruncateBlockChain = function (Param)
{
    var StartNum = SERVER.BlockNumDB - Param.BlockCount;
    var MinBlock = DApps.Accounts.GetMinBlockAct();
    if(MinBlock > StartNum)
    {
        ToLog("Cant Truncate BlockChain. Very long length. Max length=" + (SERVER.BlockNumDB - MinBlock), 0);
        return {result:0, sessionid:sessionid};
    }
    SERVER.TruncateBlockDB(StartNum);
    return {result:1, sessionid:sessionid};
}
HTTPCaller.ClearDataBase = function (Param)
{
    BlockTree.Clear();
    SERVER.ClearDataBase();
    return {result:1, sessionid:sessionid};
}
HTTPCaller.CleanChain = function (Param)
{
    if(global.CleanChain)
    {
        var StartNum = SERVER.BlockNumDB - Param.BlockCount;
        global.CleanChain(StartNum);
        return {result:1, sessionid:sessionid};
    }
    return {result:0, sessionid:sessionid};
}
HTTPCaller.GetArrStats = function (Keys,response)
{
    var arr = GET_STATDIAGRAMS(Keys);
    let Result = {result:1, sessionid:sessionid, arr:arr, STAT_MODE:global.STAT_MODE};
    if(!global.TX_PROCESS || !global.TX_PROCESS.RunRPC)
        return Result;
    var Keys2 = [];
    for(var i = 0; i < Keys.length; i++)
    {
        var Str = Keys[i];
        if(Str.substr(Str.length - 3) == "-TX")
            Keys2.push(Str.substr(0, Str.length - 3));
    }
    global.TX_PROCESS.RunRPC("GET_STATDIAGRAMS", Keys2, function (Err,Arr)
    {
        Result.result = !Err;
        if(Result.result)
        {
            for(var i = 0; i < Arr.length; i++)
            {
                var Item = Arr[i];
                Item.name = Item.name + "-TX";
                Result.arr.push(Item);
            }
        }
        var Str = JSON.stringify(Result);
        response.end(Str);
    });
    return null;
}
HTTPCaller.GetBlockChain = function (type)
{
    if(!global.SERVER || !SERVER.LoadedChainList)
    {
        return {result:0};
    }
    var MainChains = {};
    for(var i = 0; i < SERVER.LoadedChainList.length; i++)
    {
        var chain = SERVER.LoadedChainList[i];
        if(chain && !chain.Deleted)
            MainChains[chain.id] = true;
    }
    var arrBlocks = [];
    var arrLoadedChainList = [];
    var arrLoadedBlocks = [];
    for(var key in SERVER.BlockChain)
    {
        var Block = SERVER.BlockChain[key];
        if(Block)
        {
            arrBlocks.push(CopyBlockDraw(Block, MainChains));
        }
    }
    AddChainList(arrLoadedChainList, SERVER.LoadedChainList, true);
    AddMapList(arrLoadedBlocks, type, SERVER.MapMapLoaded, MainChains);
    var ArrLoadedChainList = global.HistoryBlockBuf.LoadValue("LoadedChainList", 1);
    if(ArrLoadedChainList)
        for(var List of ArrLoadedChainList)
        {
            AddChainList(arrLoadedChainList, List);
        }
    var ArrMapMapLoaded = global.HistoryBlockBuf.LoadValue("MapMapLoaded", 1);
    if(ArrMapMapLoaded)
        for(var List of ArrMapMapLoaded)
        {
            AddMapList(arrLoadedBlocks, type, List);
        }
    var obj = {LastCurrentBlockNum:SERVER.GetLastCorrectBlockNum(), CurrentBlockNum:SERVER.CurrentBlockNum, LoadedChainList:arrLoadedChainList,
        LoadedBlocks:arrLoadedBlocks, BlockChain:arrBlocks, port:SERVER.port, DELTA_CURRENT_TIME:DELTA_CURRENT_TIME, memoryUsage:process.memoryUsage(),
        IsDevelopAccount:IsDeveloperAccount(WALLET.PubKeyArr), LoadedChainCount:SERVER.LoadedChainList.length, StartLoadBlockTime:SERVER.StartLoadBlockTime,
        sessionid:sessionid, result:1};
    var obj2 = HTTPCaller.GetHotArray();
    obj.ArrTree = obj2.ArrTree;
    arrBlocks = [];
    arrLoadedChainList = [];
    arrLoadedBlocks = [];
    return obj;
}
HTTPCaller.GetHistoryTransactions = function (Params)
{
    if(typeof Params === "object" && Params.AccountID)
    {
        var Account = DApps.Accounts.ReadState(Params.AccountID);
        if(!Account)
            return {result:0};
        if(!Params.Count)
            Params.Count = 100;
        var arr = DApps.Accounts.GetHistory(Params.AccountID, Params.Count, Params.NextPos);
        if(Params.GetTxID || Params.GetDescription)
        {
            for(var i = 0; i < arr.length; i++)
            {
                var Item = arr[i];
                var Block = SERVER.ReadBlockDB(Item.BlockNum);
                if(!Block || (!Block.arrContent))
                    continue;
                var Body = Block.arrContent[Item.TrNum];
                if(!Body)
                    continue;
                if(Params.GetTxID)
                {
                    Item.TxID = GetHexFromArr(GetTxID(Item.BlockNum, Body));
                }
                if(Params.GetDescription && Item.Description === undefined)
                {
                    var TR = DApps.Accounts.GetObjectTransaction(Body);
                    if(TR)
                        Item.Description = TR.Description;
                }
            }
        }
        var Result = {Value:{SumCOIN:Account.Value.SumCOIN, SumCENT:Account.Value.SumCENT}, Name:Account.Name, Currency:Account.Currency,
            MaxBlockNum:GetCurrentBlockNumByTime(), FIRST_TIME_BLOCK:FIRST_TIME_BLOCK, result:arr.length > 0 ? 1 : 0, History:arr};
        return Result;
    }
    return {result:0};
}
function GetCopyBlock(Block)
{
    var Result = {BlockNum:Block.BlockNum, bSave:Block.bSave, TreeHash:GetHexFromAddres(Block.TreeHash), AddrHash:GetHexFromAddres(Block.AddrHash),
        PrevHash:GetHexFromAddres(Block.PrevHash), SumHash:GetHexFromAddres(Block.SumHash), SumPow:Block.SumPow, TrDataPos:Block.TrDataPos,
        TrDataLen:Block.TrDataLen, SeqHash:GetHexFromAddres(Block.SeqHash), Hash:GetHexFromAddres(Block.Hash), Power:GetPowPower(Block.PowHash),
        TrCount:Block.TrCount, arrContent:Block.arrContent, };
    return Result;
}
var AddrLength = 16;
function GetHexFromAddresShort(Hash)
{
    return GetHexFromAddres(Hash).substr(0, AddrLength);
}
function GetHexFromStrShort(Str)
{
    if(Str === undefined)
        return Str;
    else
        return Str.substr(0, AddrLength);
}
var glid = 0;
function GetGUID(Block)
{
    if(!Block)
        return "------";
    if(!Block.guid)
    {
        glid++;
        Block.guid = glid;
    }
    return Block.guid;
}
function CopyBlockDraw(Block,MainChains)
{
    var MinerID = 0;
    var MinerName = "";
    if(Block.AddrHash)
    {
        var Num = ReadUintFromArr(Block.AddrHash, 0);
        MinerID = Num;
        var Item = DApps.Accounts.ReadState(Num);
        if(Item && Item.Name)
            MinerName = Item.Name.substr(0, 8);
    }
    var CheckPoint = 0;
    if(Block.BlockNum === CHECK_POINT.BlockNum)
        CheckPoint = 1;
    var Mining;
    if(SERVER.MiningBlock === Block)
        Mining = 1;
    else
        Mining = 0;
    GetGUID(Block);
    var Item = {guid:Block.guid, Active:Block.Active, bSave:Block.bSave, Prepared:Block.Prepared, BlockNum:Block.BlockNum, Hash:GetHexFromAddresShort(Block.Hash),
        SumHash:GetHexFromAddresShort(Block.SumHash), SeqHash:GetHexFromAddresShort(Block.SeqHash), TreeHash:GetHexFromAddresShort(Block.TreeHash),
        AddrHash:GetHexFromAddresShort(Block.AddrHash), MinerID:MinerID, MinerName:MinerName, Comment1:Block.Comment1, Comment2:Block.Comment2,
        SumPow:Block.SumPow, Info:Block.Info, TreeLoaded:Block.TreeEq, AddToLoad:Block.AddToLoad, LoadDB:Block.LoadDB, FindBlockDB:Block.FindBlockDB,
        TrCount:Block.TrCount, ArrLength:0, TrDataLen:Block.TrDataLen, Power:GetPowPower(Block.PowHash), CheckPoint:CheckPoint, Mining:Mining,
        TransferSize:Block.TransferSize, HasErr:Block.HasErr, };
    if(Block.chain)
        Item.chainid = Block.chain.id;
    if(Block.LoadDB !== undefined)
        Item.bSave = Block.LoadDB;
    if(Block.arrContent)
        Item.TrCount = Block.arrContent.length;
    Item.BlockDown = GetGUID(Block.BlockDown);
    if(MainChains && Item.chainid)
    {
        Item.Main = MainChains[Item.chainid];
    }
    return Item;
}
function CopyChainDraw(Chain,bWasRecursive,bMain)
{
    if(!Chain)
        return Chain;
    GetGUID(Chain);
    var Item = {guid:Chain.guid, id:Chain.id, chainid:Chain.id, bSave:Chain.LoadDB, FindBlockDB:Chain.FindBlockDB, GetFindDB:Chain.GetFindDB(),
        BlockNum:Chain.BlockNumStart, Hash:GetHexFromAddresShort(Chain.HashStart), Comment1:Chain.Comment1, Comment2:Chain.Comment2,
        StopSend:Chain.StopSend, SumPow:0, Info:Chain.Info, IsSum:Chain.IsSum, Main:bMain, };
    if(Chain.IsSumStart)
    {
        Item.SumHash = Item.Hash;
        Item.Hash = "-------";
    }
    if(Chain.RootChain)
    {
        var rootChain = Chain.GetRootChain();
        if(rootChain)
        {
            Item.rootid = rootChain.id;
            if(!bWasRecursive)
                Item.root = CopyChainDraw(rootChain, true);
        }
    }
    else
        Item.rootid = "";
    if(Chain.BlockHead)
    {
        Item.HashMaxStr = GetGUID(Chain.BlockHead);
        Item.BlockNumMax = Chain.BlockHead.BlockNum;
    }
    else
    {
        Item.HashMaxStr = "------";
    }
    return Item;
}
function AddChainList(arrLoadedChainList,LoadedChainList,bMain)
{
    for(var chain of LoadedChainList)
    {
        if(chain)
        {
            arrLoadedChainList.push(CopyChainDraw(chain, false, bMain));
        }
    }
}
function AddMapList(arrLoadedBlocks,type,MapMapLoaded,MainChains)
{
    for(var key in MapMapLoaded)
    {
        var map = MapMapLoaded[key];
        if(map)
        {
            for(var key in map)
            {
                var Block = map[key];
                if(key.substr(1, 1) === ":")
                    continue;
                if(!Block.Send || type === "reload")
                {
                    arrLoadedBlocks.push(CopyBlockDraw(Block, MainChains));
                    Block.Send = true;
                }
            }
        }
    }
}
var MapFileHTML5 = {};
function SendWebFile(response,name,StrCookie,bParsing,Long)
{
    var type = name.substr(name.length - 4, 4);
    var index1 = type.indexOf(".");
    type = type.substr(index1 + 1);
    var Path;
    if(name.substr(0, 2) !== "./")
        Path = "./" + name;
    else
        Path = name;
    if(!fs.existsSync(Path))
    {
        if(!global.DEV_MODE || type === "ico")
        {
            response.writeHead(404, {'Content-Type':'text/html'});
            response.end();
            return ;
        }
        var data = "Not found: " + name;
        response.end(data);
        return ;
    }
    var StrContentType = ContenTypeMap[type];
    if(!StrContentType)
        StrContentType = DefaultContentType;
    var Headers = {};
    if(StrContentType === "text/html")
    {
        Headers = {'Content-Type':'text/html', "X-Frame-Options":"sameorigin"};
        if(StrCookie)
            Headers['Set-Cookie'] = StrCookie;
    }
    else
    {
        if(StrContentType === "application/font-woff")
        {
            Headers['Content-Type'] = StrContentType;
            Headers['Access-Control-Allow-Origin'] = "*";
        }
        else
        {
            Headers['Content-Type'] = StrContentType;
        }
    }
    var ArrPath = Path.split('/', 5);
    var ShortName = ArrPath[ArrPath.length - 1];
    var Long2 = CacheMap[ShortName];
    if(Long2)
        Long = Long2;
    if(global.DEV_MODE)
        Long = 1;
    if(Long)
    {
        Headers['Cache-Control'] = "max-age=" + Long;
    }
    response.writeHead(200, Headers);
    if(bParsing && StrContentType === "text/html")
    {
        var data = GetFileHTMLWithParsing(Path);
        response.end(data);
        return ;
    }
    else
        if("image/jpeg,image/vnd.microsoft.icon,image/svg+xml,image/png,application/javascript,text/css,text/html".indexOf(StrContentType) >  - 1)
        {
            var data = GetFileSimpleBin(Path);
            response.end(data);
            return ;
        }
    const stream = fs.createReadStream(Path);
    setTimeout(function ()
    {
        stream.close();
        stream.push(null);
        stream.read(0);
    }, 100000);
    stream.pipe(response);
}
function GetFileHTMLWithParsing(Path)
{
    var data = global.SendHTMLMap[Path];
    if(!data)
    {
        global.SendHTMLMap[Path] = "-recursion-";
        data = String(fs.readFileSync(Path));
        data = ParseTag(data, "File", 0);
        data = ParseTag(data, "Edit", 1);
        global.SendHTMLMap[Path] = data;
    }
    return data;
}
var glEditNum = 0;
function ParseTag(Str,TagName,bEdit)
{
    var bWasInject = 0;
    var data = "";
    var index = 0;
    while(index >= 0)
    {
        index = Str.indexOf("{{" + TagName + "=", index);
        if(index >= 0)
        {
            var index2 = Str.indexOf("}}", index + 3 + TagName.length);
            if(index2 < 0)
            {
                ToLog("Error teg " + TagName + " in " + Path);
                break;
            }
            var Delta = index2 - index;
            if(Delta > 210)
            {
                ToLog("Error length (more 200) teg File in " + Path);
                break;
            }
            var Path2 = Str.substring(index + 3 + TagName.length, index + Delta);
            data += Str.substring(0, index);
            if(bEdit)
            {
                if(!bWasInject)
                {
                    data = data + GetFileSimple("./SITE/JS/web-edit.html");
                    bWasInject = 1;
                }
                glEditNum++;
                data += "<DIV class='' id='idEdit" + glEditNum + "'>";
                data += GetFileHTMLFromMarkdown(Path2);
                data += "</DIV>";
                data += "<script>AddNewEditTag('idEdit" + glEditNum + "','" + Path2 + "');</script>";
            }
            else
            {
                data += GetFileHTMLWithParsing(Path2);
            }
            Str = Str.substring(index2 + 2);
            index = 0;
        }
    }
    data += Str;
    return data;
}
var MarkLib;
function GetFileHTMLFromMarkdown(Path)
{
    var data = global.SendHTMLMap[Path];
    if(!data)
    {
        if(MarkLib === undefined)
            MarkLib = require("../HTML/JS/marked.js");
        var Str = "";
        if(fs.existsSync(Path))
            Str = String(fs.readFileSync(Path));
        data = MarkLib(Str);
        global.SendHTMLMap[Path] = data;
    }
    return data;
}
function GetFileSimple(Path)
{
    var Key = "GetFileSimple-" + Path;
    var data = global.SendHTMLMap[Key];
    if(!data)
    {
        data = String(fs.readFileSync(Path));
        global.SendHTMLMap[Key] = data;
    }
    return data;
}
function GetFileSimpleBin(Path)
{
    var Key = "GetFileSimpleBin-" + Path;
    var data = global.SendHTMLMap[Key];
    if(!data)
    {
        data = (fs.readFileSync(Path));
        global.SendHTMLMap[Key] = data;
    }
    return data;
}
function SaveFileSimple(Path,Str)
{
    global.SendHTMLMap = {};
    var Key = "GetFileSimple-" + Path;
    global.SendHTMLMap[Key] = Str;
    SaveToFile(Path, Str);
}
global.SendHTMLMap = {};
global.SendWebFile = SendWebFile;
global.GetFileHTMLWithParsing = GetFileHTMLWithParsing;
global.GetFileHTMLFromMarkdown = GetFileHTMLFromMarkdown;
global.GetFileSimple = GetFileSimple;
global.SaveFileSimple = SaveFileSimple;
function ReloaSenddBufer()
{
    global.SendHTMLMap = {};
}
setInterval(ReloaSenddBufer, 60 * 1000);
if(global.DEV_MODE)
    setInterval(ReloaSenddBufer, 1 * 1000);
function GetStrTime(now)
{
    if(!now)
        now = GetCurrentTime(0);
    var Str = "" + now.getHours().toStringZ(2);
    Str = Str + ":" + now.getMinutes().toStringZ(2);
    Str = Str + ":" + now.getSeconds().toStringZ(2);
    return Str;
}
function OnGetData(arg)
{
    var response = {end:function ()
        {
        }, writeHead:function ()
        {
        }, };
    var Path = arg.path;
    var obj = arg.obj;
    if(Path.substr(0, 1) === "/")
        Path = Path.substr(1);
    var params = Path.split('/', 5);
    var Ret;
    var F = HTTPCaller[params[0]];
    if(F)
    {
        if(obj)
            Ret = F(obj);
        else
            Ret = F(params[1], params[2], params[3]);
    }
    else
    {
        Ret = {result:0};
    }
    return Ret;
}
function parseCookies(rc)
{
    var list = {};
    rc && rc.split(';').forEach(function (cookie)
    {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
}
global.SetSafeResponce = SetSafeResponce;
function SetSafeResponce(response)
{
    if(!response.Safe)
    {
        response.Safe = 1;
        response._end = response.end;
        response._writeHead = response.writeHead;
        response.end = function ()
        {
            try
            {
                if(global.STAT_MODE === 2 && arguments && arguments[0] && arguments[0].length)
                {
                    ADD_TO_STAT("HTTP_SEND", arguments[0].length);
                    if(response.DetailStatName)
                        ADD_TO_STAT("HTTP_SEND" + response.DetailStatName, arguments[0].length);
                }
                response._end.apply(response, arguments);
            }
            catch(e)
            {
                ToError("H##1");
                ToError(e);
            }
        };
        response.writeHead = function ()
        {
            try
            {
                response._writeHead.apply(response, arguments);
            }
            catch(e)
            {
                ToError("H##2");
                ToError(e);
            }
        };
    }
}
if(global.HTTP_PORT_NUMBER)
{
    var ClientTokenMap = {};
    var ClientIPMap = {};
    var ClientIPMap2 = {};
    setInterval(function ()
    {
        ClientTokenMap = {};
    }, 24 * 3600 * 1000);
    var port = global.HTTP_PORT_NUMBER;
    var HTTPServer = http.createServer(function (request,response)
    {
        if(!request.headers)
            return ;
        if(!request.socket || !request.socket.remoteAddress)
            return ;
        var remoteAddress = request.socket.remoteAddress.replace(/^.*:/, '');
        if(remoteAddress === "1")
            remoteAddress = "127.0.0.1";
        var CheckPassword;
        if(!global.HTTP_PORT_PASSWORD && remoteAddress.indexOf("127.0.0.1") < 0)
            return ;
        if(global.HTTP_IP_CONNECT && remoteAddress.indexOf("127.0.0.1") < 0 && global.HTTP_IP_CONNECT.indexOf(remoteAddress) < 0)
            return ;
        CheckPassword = 1;
        SetSafeResponce(response);
        if(!global.SERVER)
        {
            response.writeHead(404, {'Content-Type':'text/html'});
            response.end("");
            return ;
        }
        var fromURL = url.parse(request.url);
        var Path = querystring.unescape(fromURL.path);
        if(global.NWMODE)
        {
            Path = Path.replace("HTML/HTML", "HTML");
        }
        if(!ClientIPMap[remoteAddress])
        {
            ClientIPMap[remoteAddress] = 1;
            ToLog("TRY CONNECT TO HTTP ACCESS FROM: " + remoteAddress, 0);
            ToLog("Path: " + Path, 0);
        }
        if(CheckPassword && global.HTTP_PORT_PASSWORD)
        {
            var StrPort = "";
            if(global.HTTP_PORT_NUMBER !== 80)
                StrPort = global.HTTP_PORT_NUMBER;
            var cookies = parseCookies(request.headers.cookie);
            var cookies_token = cookies["token" + StrPort];
            var cookies_hash = cookies["hash" + StrPort];
            if(cookies_token && cookies_hash && ClientTokenMap[cookies_token] === 0)
            {
                if(cookies_hash.substr(0, 4) !== "0000")
                {
                    SendWebFile(response, "./HTML/password.html", "token" + StrPort + "=" + cookies_token + ";path=/");
                    return ;
                }
                var nonce = 0;
                var index = cookies_hash.indexOf("-");
                if(index > 0)
                {
                    nonce = parseInt(cookies_hash.substr(index + 1));
                    if(!nonce)
                        nonce = 0;
                }
                var hash = ClientHex(cookies_token + "-" + global.HTTP_PORT_PASSWORD, nonce);
                if(hash === cookies_hash)
                {
                    ClientTokenMap[cookies_token] = 1;
                }
                else
                {
                    SendWebFile(response, "./HTML/password.html", "token" + StrPort + "=" + cookies_token + ";path=/");
                    return ;
                }
            }
            if(!cookies_token || !ClientTokenMap[cookies_token])
            {
                var StrToken = GetHexFromArr(crypto.randomBytes(16));
                ClientTokenMap[StrToken] = 0;
                SendWebFile(response, "./HTML/password.html", "token" + StrPort + "=" + StrToken + ";path=/");
                return ;
            }
        }
        if(!ClientIPMap2[remoteAddress])
        {
            ClientIPMap2[remoteAddress] = 1;
            ToLog("OK CONNECT TO HTTP ACCESS FROM: " + remoteAddress, 0);
            ToLog("Path: " + Path, 0);
        }
        var params = Path.split('/', 6);
        params.splice(0, 1);
        var Type = request.method;
        if(Type === "POST")
        {
            let Response = response;
            let Params = params;
            let postData = "";
            request.addListener("data", function (postDataChunk)
            {
                if(postData.length < 70000 && postDataChunk.length < 70000)
                    postData += postDataChunk;
            });
            request.addListener("end", function ()
            {
                var Data;
                try
                {
                    Data = JSON.parse(postData);
                }
                catch(e)
                {
                    ToError("--------Error data parsing : " + Params[0] + " " + postData.substr(0, 200));
                    Response.writeHead(405, {'Content-Type':'text/html'});
                    Response.end("Error data parsing");
                }
                if(Params[0] === "HTML")
                    DoCommand(response, Type, Path, [Params[1], Data], remoteAddress);
                else
                    DoCommand(response, Type, Path, [Params[0], Data], remoteAddress);
            });
        }
        else
        {
            DoCommand(response, Type, Path, params, remoteAddress);
        }
    }).listen(port, LISTEN_IP, function ()
    {
        global.HTTP_SERVER_START_OK = 1;
        ToLog("Run HTTP-server on " + LISTEN_IP + ":" + port);
    });
    HTTPServer.on('error', function (err)
    {
        ToError("H##3");
        ToError(err);
    });
}
if(global.ELECTRON)
{
    const ipcMain = require('electron').ipcMain;
    ipcMain.on('GetData', function (event,arg)
    {
        event.returnValue = OnGetData(arg);
    });
}
exports.SendData = OnGetData;
function RunConsole(StrRun)
{
    var Str = fs.readFileSync("./EXPERIMENTAL/_run-console.js", {encoding:"utf8"});
    if(StrRun)
        Str += "\n" + StrRun;
    try
    {
        var ret = eval(Str);
    }
    catch(e)
    {
        ret = e.message + "\n" + e.stack;
    }
    return ret;
}
var WebWalletUser = {};
function GetUserContext(Params)
{
    if(typeof Params.Key !== "string")
        Params.Key = "" + Params.Key;
    var StrKey = Params.Key + "-" + Params.Session;
    var Context = WebWalletUser[StrKey];
    if(!Context)
    {
        Context = {NumDappInfo:0, PrevDappInfo:"", NumAccountList:0, PrevAccountList:"", LastTime:0, FromEventNum:0};
        Context.Session = Params.Session;
        Context.Key = StrKey;
        WebWalletUser[StrKey] = Context;
    }
    return Context;
}
global.GetUserContext = GetUserContext;
global.EventNum = 0;
global.EventMap = {};
function AddDappEventToGlobalMap(Data)
{
    global.EventNum++;
    Data.EventNum = global.EventNum;
    Data.EventDate = Date.now();
    var Arr = global.EventMap[Data.Smart];
    if(!Arr)
    {
        Arr = [];
        global.EventMap[Data.Smart] = Arr;
    }
    if(Arr.length < 1000)
    {
        Arr.push(Data);
    }
}
global.AddDappEventToGlobalMap = AddDappEventToGlobalMap;
function DeleteOldEvents(SmartNum)
{
    var CurDate = Date.now();
    var Arr = global.EventMap[SmartNum];
    while(Arr && Arr.length)
    {
        var Event = Arr[0];
        if(!Event || CurDate - Event.EventDate < 5000)
        {
            break;
        }
        Arr.splice(0, 1);
    }
}
function GetEventArray(SmartNum,Context)
{
    var Arr = global.EventMap[SmartNum];
    if(!Arr || Arr.length === 0)
    {
        return [];
    }
    var FromEventNum = Context.FromEventNum;
    var ArrRet = [];
    for(var i = 0; i < Arr.length; i++)
    {
        var Event = Arr[i];
        if(Event.EventNum >= FromEventNum)
            ArrRet.push(Event);
    }
    if(ArrRet.length)
    {
        Context.FromEventNum = ArrRet[ArrRet.length - 1].EventNum + 1;
    }
    return ArrRet;
}
HTTPCaller.GetHashRate = function (ArrParams)
{
    var AllReadCount = 0;
    var CurBlockNum = GetCurrentBlockNumByTime();
    var ResArr = [];
    for(var i = 0; i < ArrParams.length; i++)
    {
        var Item = ArrParams[i];
        if(!Item)
        {
            ResArr[i] = undefined;
            continue;
        }
        if(Item.BlockNum1 < 0)
            Item.BlockNum1 = 0;
        if(Item.BlockNum2 > CurBlockNum)
            Item.BlockNum2 = CurBlockNum;
        var Delta = Item.BlockNum2 - Item.BlockNum1;
        var Count = Delta;
        if(Count > 20)
            Count = 20;
        else
            if(Count <= 0)
                Count = 1;
        var StepDelta = Math.floor(Delta / Count);
        if(StepDelta < 1)
            StepDelta = 1;
        var CountAvg = 3;
        var StepDeltaAvg = Math.floor(StepDelta / CountAvg);
        if(StepDeltaAvg < 1)
            StepDeltaAvg = 1;
        var ItervalArr = [];
        for(var Num = Item.BlockNum1; Num < Item.BlockNum2; Num += StepDelta)
        {
            var Power;
            var Item2 = BlockTree.LoadValue(Num, 1);
            if(Item2 && i !== ArrParams.length - 1)
            {
                Power = Item2.Power;
            }
            else
            {
                var Sum = 0;
                var CountSum = 0;
                for(var d = 0; d < CountAvg; d++)
                {
                    var Block = SERVER.ReadBlockHeaderFromMapDB(Num + d * StepDeltaAvg);
                    if(Block)
                    {
                        if(!Block.FromMap)
                            AllReadCount++;
                        CountSum++;
                        Sum += GetPowPower(Block.PowHash);
                    }
                }
                if(!CountSum)
                    CountSum = 1;
                Power = Math.floor(Sum / CountSum);
                if(Power)
                    BlockTree.SaveValue(Num, {BlockNum:Num, Power:Power});
            }
            ItervalArr.push(Power);
        }
        ResArr[i] = ItervalArr;
    }
    return {result:1, ItervalArr:ResArr};
}
function DoGetTransactionByID(response,Params)
{
    var result = GetTransactionByID(Params);
    response.writeHead(200, {'Content-Type':'text/html'});
    response.end(JSON.stringify(result));
}
HTTPCaller.GetTransaction = function (Params,response)
{
    var result;
    if(typeof Params === "object" && Params.TxID)
    {
        result = GetTransactionByID(Params);
    }
    else
    {
        result = {result:0};
    }
    response.writeHead(200, {'Content-Type':'text/plain'});
    response.end(JSON.stringify(result));
}
global.GetTransactionByID = GetTransactionByID;
function GetTransactionByID(Params)
{
    var BlockNum;
    if(typeof Params.TxID === "string")
    {
        var Arr = GetArrFromHex(Params.TxID);
        BlockNum = ReadUintFromArr(Arr, TR_TICKET_HASH_LENGTH);
        var Block = SERVER.ReadBlockDB(BlockNum);
        if(Block && Block.arrContent)
        {
            for(var i = 0; i < Block.arrContent.length; i++)
            {
                var Body = Block.arrContent[i];
                var Arr2 = GetTxID(BlockNum, Body);
                if(CompareArr(Arr2, Arr) === 0)
                {
                    return GetTransactionFromBody(Params, Block, i, Body);
                }
            }
        }
    }
    return {result:0, Meta:Params ? Params.Meta : undefined, BlockNum:BlockNum};
}
global.GetTransactionFromBody = GetTransactionFromBody;
function GetTransactionFromBody(Params,Block,TrNum,Body)
{
    var TR = DApps.Accounts.GetObjectTransaction(Body);
    if(TR)
    {
        ConvertBufferToStr(TR);
        TR.result = 1;
        TR.Meta = Params.Meta;
        if(Block.VersionBody === 1 && Block.arrContentResult)
        {
            TR.result = Block.arrContentResult[TrNum];
        }
        TR.BlockNum = Block.BlockNum;
        TR.TrNum = TrNum;
        return TR;
    }
    return {result:0, BlockNum:Block.BlockNum, Meta:Params ? Params.Meta : undefined};
}
require("../process/api-exchange.js");
