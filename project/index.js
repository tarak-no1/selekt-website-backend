'use strict'
// get Bot, const, and Facebook API
// Setting up our bot
// Starting our web server and putting it all together
const bodyParser = require('body-parser')
const express = require('express')
const sessions = require('./sessions.js')
const global = require('./global.js')
const helper = require('./helper');
const elasticSearch = require('./db_config/elasticSearch.js')
const mongo = require('./db_config/mongoQueries')
const filterList = require('./filter-list')
const website = require('./website.js')
const mysql = require('mysql');
const offline = require("./offline_bot");
const mapping = require("./mapping");
const conversationGraph = require('./conversationGraphs');
const device = require('express-device'); 
const entity_bot = require("./entity_bot");
const autoCompleteHelper = require('../../autoComplete/autoCompleteHelper');
const autoComplete = require('../../autoComplete/autoComplete');
const dataConfig = require('../../autoComplete/dataConfig');
const fashion_bot = require("./fashion_bot");
const fs = require("fs");

//mobile category
const mobile_bot = require('./mobile/bot');
const mobile_url_messages = require("./mobile/url_messages");
const mobile_question_flow = JSON.parse(fs.readFileSync("./mobile/question_flow_mobile.json"));
const mobile_conversationgraph = JSON.parse(fs.readFileSync("./mobile/conversation_rules_mobile.json"));

const word_mapping = JSON.parse(fs.readFileSync("./json/word_mapping.json"));
let db_config = {
    host: 'localhost',
    user: 'root',
    password: 'selekt.in'
}
let connection
function handleDisconnect() {
    connection = mysql.createConnection(db_config)
    connection.connect(function (err) {
        if (err) {
            console.log('error when connecting to db:', err)
            setTimeout(handleDisconnect, 2000)
        }
    })
    connection.on('error', function (err) {
        console.log('db error', err)
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect()
        } else {
            throw err
        }
    })
}
handleDisconnect()
const app = express();
app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(device.capture());
let server = require('http').createServer(app)
let port = 2222
global.io = require('socket.io')(server)
let session_status = true;
server.listen(port,'0.0.0.0', function () {
    console.log('started socket successfully : ' + ':' + port)
})
app.get('/', function (req, res) {
    let x = req.device.type
    if (x == 'desktop') {
        console.log("desktop");
        res.send('"Only those who will risk going too far can possibly find out how far one can go." - T.S. Eliot')
    }
    else {
        console.log("not desktop")
        res.send("For " + req.device.type + " use please install app from Google Play Store 'selekt beta'");
    }
});
/*
* when user starting the new conversation, we are calling this function
* @param socket 
* @param {string} sessionId
* @param {string} tab_id 
* @param {string} from
*/
function welcomeMessage(socket, sessionId,tab_id, from, device)
{
    // Sending welcome message to user
    console.log("Sending welcome message to user");
    if(from=="reset")
    {
        let message = {
            type: 'text',
            end_of_chat : false,
            product_line_status : false,
            message: 'Hey. I am your Fashion Shopping Assistant. I can help you find the right clothes based on your need.'
        }
        let event_time = new Date().getTime();
        setTimeout(function(a){
            let welcome_event=
            {
                type : "welcome_message",
                time : event_time,
                details : message
            };
            helper.logger_api_call(sessionId,tab_id, welcome_event, welcome_event["type"]);
        },1);
        socket.emit('chat', message);
    }
    //sending suggestion message to the user
    let msg = 
    {
        type : "text",
        question_number : 0,
        end_of_chat : false,
        product_line_status : false,
        message : "Quick suggestions :"
            +" \n\t- Kurtas"
            +" \n\t- Jeans under 999"
            +"\n\t- Dresses for women with tummy"
            +"\n\t- Pastel color tshirts"
            +"\n\t- Need a skirt for a date"
    };
    if(device)
        device = device.toLowerCase();
    if((from=="women" || from=="reset") && device!='desktop')
    {
        setTimeout(function(){
            let welcome_event=
            {
                type : "welcome_message",
                time : new Date().getTime(),
                details : msg
            };
            helper.logger_api_call(sessionId,tab_id, welcome_event, welcome_event["type"]);
            socket.emit('chat', msg);
        },2000);
    }
}

/*
* this is helps open the socket connect
* @param socket 
*/
global.io.on('connection', function (socket)
{
    console.log('New socket connection from user ');
    /*
    * new user request from website
    * @param {obj} data 
    */
    socket.on('add user', function (data) {
        data = JSON.parse(data);
        console.log("Add user");
        // console.log('`````````````````` Message on Add User ```````````````````');
        // console.log(JSON.stringify(data, null, 2));
        // console.log('````````````````````````````````````````');

        let user_agent = socket.request.headers['user-agent'];
        
        // avoid if any crawler is access this socket
        if(!helper.crawlerStatus(user_agent))
        {
            let sessionId = data['session_id'];
            let deviceId = data['device_id'];
            let device = data["device"];
            let landing_page = data["landing_page_url"];
            let tab_id = data["tab_id"];
            let user_id = data["user_id"];
            let login_status = data["login_status"];
            let message = data["message"];
            // console.log("Session Id : ",sessionId);
            // console.log("is Session Already Existed : ",sessions.isSessionExists(sessionId, tab_id));
            try
            {
                let context= null;
                // check user session is existed or not
                if (!sessions.isSessionExists(sessionId, tab_id)) 
                {
                    // create the new user session 
                    sessions.CreateSession(sessionId, deviceId, session_status, landing_page, tab_id);
                    //session_status = !session_status;

                    //getting the user session context
                    context = sessions.getContext(sessionId, tab_id);
                }
                else
                {
                    // clearing the user session context if user reconnected
                    context = sessions.clearContext(sessionId, tab_id);
                    sessions.storeContext(sessionId, tab_id, context);
                }
                if(message=="women")
                    context["delay"] = 4000;
                else
                    context["delay"] = 2000;

                // updating the user context with new changes
                sessions.storeContext(sessionId, tab_id, context);

                //saving user details for backend event storing
                let user_details = {
                    device_id : deviceId,
                    unique_id : deviceId,
                    session_id : sessionId,
                    device : device
                };
                if(login_status)
                {
                    user_details["user_id"] = user_id;
                }
                // create user data, it will be useful in user event capturing
                sessions.createUserDetails(sessionId, user_details);

                // sending the welcome message to the user
                welcomeMessage(socket, sessionId, tab_id, message, device);
                //storing the user socket
                global.storeUserSocket(sessionId, tab_id, socket);
                // sending login success message to user
            }catch(e)
            {
                // error while creating socket
            }
        }
    });

    /*
    * user typed message came from the user
    * @param {obj} data 
    */
    socket.on('user message', function (data)
    {
        data = JSON.parse(data);
        let event_time = new Date().getTime();
        let sessionId = data['session_id'];
        let deviceId = data['device_id'];
        let message = data["message"];
        let tabId = data["tab_id"];

        global.storeUserSocket(sessionId, tabId, socket);

        let user_context = sessions.getContext(sessionId, tabId);
        if(user_context["unanswered_question"]=="take_feedback")
        {
            fashion_bot.processingUserAnswer["feedbackQuestion"](sessionId, tabId, [message]);
            user_context["unanswered_question"] = undefined;
        }
        else
        {
            //sending to wit
            fashion_bot.processingMessage(sessionId, tabId, message, event_time, false);
        }
    });

    /*
    * url message came from the user
    * @param {obj} data 
    */
    socket.on('web message', function (data) {
    	let event_time = new Date().getTime();
        data = JSON.parse(data);
        let sessionId = data['session_id'];
        let deviceId = data['device_id'];
        let message = data["message"];
        let tabId = data["tab_id"];
        global.storeUserSocket(sessionId, tabId, socket);
        //sending to wit
        fashion_bot.processingMessage(sessionId, tabId, message, event_time, true);
    });

    /*
    * user selected message came, after the bot suggestions
    * @param {obj} data 
    */
    socket.on('user answers', function (data)
    {
        data = JSON.parse(data);
        console.log("User answer");
        //console.log(JSON.stringify(data, null, 2));
        let sessionId = data['session_id'];
        let deviceId = data['device_id'];
        let tabId = data["tab_id"];

        let previous_quesiton_belongs = data["belongs"];
        let answer_keys = data['keys'];

        //storing the current socket of the user
        global.storeUserSocket(sessionId, tabId, socket);
        fashion_bot.processingUserAnswer[previous_quesiton_belongs](sessionId, tabId, answer_keys);
    });
    /*
    * user updated the body profile
    * @param {obj} data 
    */
    socket.on('user_profile',function(data)
    {
        data = JSON.parse(data);
        console.log("User profile Updated >>>>>>>>>>>>>>>>>>>>>>>");
        // console.log(data);
        let sessionId = data['session_id'];
        let deviceId = data['device_id'];
        let landing_page = data["landing_page_url"];
        let login_status = data["login_status"];
        let user_id = data["user_id"];
        let tab_id = data["tab_id"];
        let type = data["type"];

        // Checking Session is Exists or not
        if (!sessions.isSessionExists(sessionId, tab_id)) {
            sessions.CreateSession(sessionId, deviceId, session_status,landing_page, tab_id);
        }
        global.storeUserSocket(sessionId,tab_id, socket);

        let context = sessions.getContext(sessionId, tab_id);
        let user_profile = {};
        if (data.hasOwnProperty("body_shape") && data['body_shape']!="") {
            user_profile.bodyshape = data['body_shape'];
        }
        if (data.hasOwnProperty("skin_color") && data['skin_color']!="") 
        {    
            user_profile.skintone = data['skin_color'];
        }
        if(data.hasOwnProperty("age") && data["age"]!="")
        {
            user_profile.age = data['age']; 
        }
        if(data.hasOwnProperty("height") && data["height"]!="")
        {
            user_profile.height = data['height']; 
        }
        if(data.hasOwnProperty("body_concerns"))
        {
            user_profile.body_concerns = data["body_concerns"];
        }
        if(type=="already_existed") // user profile already existed state
        {
            sessions.storeContext(sessionId,tab_id,context);
        }
        else if(type=="profile_question") // checking user selected the body profile question or not 
        {
            delete context["user_profile"]["age"];
            delete context["user_profile"]["height"];
            delete context["user_profile"]["bodyshape"];
            delete context["user_profile"]["skintone"];
            let user_profile_keys = Object.keys(user_profile);
            for(let i in user_profile_keys)
            {
                let profile_value = user_profile_keys[i];
                context["user_profile"][profile_value] = user_profile[profile_value];
            }
            context["user_profile"]["profile_status"] = true;
            sessions.storeContext(sessionId,tab_id,context);
        	fashion_bot.processingUserAnswer["bodyProfileQuestion"](sessionId, tab_id, user_profile);
        }
        else if(type=="body_concerns_question") // checking the user selected the body concerns or not
        {
            context["user_profile"]["concern_status"] = true;
            context["user_profile"]["body_concerns"] = user_profile["body_concerns"];
            sessions.storeContext(sessionId,tab_id,context);
        	fashion_bot.processingUserAnswer["bodyConcernQuestion"](sessionId, tab_id, user_profile["body_concerns"]);
        }        
    });

    /*
    * user clicked on the undo button
    * @param {obj} data 
    */
    socket.on("undo", function(data)
    {
        // this is used to going to the previous state
        let event_time = new Date().getTime();
        data = JSON.parse(data);
        console.log("Undo");
        let sessionId = data["session_id"];
        let tab_id = data["tab_id"];
        let category= data["category"];
        // checking the category
        if(category=="mobile")
        {

        }
        else
        {
            let context = sessions.getContext(sessionId, tab_id);
            setTimeout(function(){
                // Event SToring =========================
                let web_event = 
                {
                    type : "clicked_on_undo",
                    time : event_time,
                    chat_id : context.chat_id,
                    details : {}
                };
                helper.logger_api_call(sessionId,tab_id, web_event, web_event["type"]);
                //=======================================
            },1);
            
            global.storeUserSocket(sessionId,tab_id, socket);
            offline.getUndoState(sessionId,tab_id);
        }
    });
    /*
    * user clicked on the reset button
    * @param {obj} data 
    */
    socket.on("reset",function(data)
    {
        // clearing total user context
        // and starting the new conversation flow
        let event_time = new Date().getTime();
        console.log("Reset");
        data = JSON.parse(data);
        let sessionId = data["session_id"];
        let tab_id = data["tab_id"];
        let category = data["category"];
        let device = data["device"];

        if(category=="mobile")
        {
            let context = sessions.clearMobileContext(sessionId, tab_id);
            sessions.storeMobileContext(sessionId, tab_id, context);
            let category_welcome_message = 
            {
                type : "text",
                reason_status : false,
                end_of_chat : false,
                question_number : 0,
                product_line_status : false,
                message : "You can ask questions like : \n\t"+
                    "- Phones that can take great pictures\n\t"+
                    "- Best android phones\n\t"+
                    "- Water resistant phones"
            };
            socket.emit("chat",category_welcome_message);
        }
        else{
            let context = sessions.getContext(sessionId, tab_id);
            setTimeout(function(){
                // Event SToring =========================
                let web_event = 
                {
                    type : "clicked_on_reset",
                    time : event_time,
                    chat_id : context.chat_id,
                    details : {}
                };
                helper.logger_api_call(sessionId,tab_id, web_event, web_event["type"]);
                //=======================================
            },1)
            context = sessions.clearContext(sessionId, tab_id);
            context["delay"] = 4000;
            sessions.storeContext(sessionId,tab_id, context);
            global.storeUserSocket(sessionId,tab_id, socket);

            welcomeMessage(socket, sessionId, tab_id, "reset", device);      
        }
    });

    //mobile section
    socket.on("mobile_category",function(data)
    {
    	console.log("mobile category");
        data = JSON.parse(data);
        // console.log("mobile section =================================");
        // console.log(JSON.stringify(data, null, 2));
        let deviceId = data["device_id"];
        let sessionId = data["session_id"];
        let tabId = data["tab_id"];
        if(!sessions.isMobileSessionExist(sessionId,tabId))
        {
            sessions.createMobileSession(deviceId, sessionId, tabId);
        }
        global.storeUserSocket(sessionId, tabId,socket);
        let category_welcome_message = 
        {
            type : "text",
            end_of_chat : false,
            product_line_status : false,
            message : "You can ask questions like : \n\t"+
                "- Phones that can take great pictures\n\t"+
                "- Best android phones\n\t"+
                "- Water resistant phones"
        };
        setTimeout(function()
        {
            socket.emit("chat",category_welcome_message);
        },4000);
    });
    socket.on("mobile_user_message", function(data)
    {
        // console.log("------------------- Mobile section --------------------");
        data = JSON.parse(data);
        console.log("new user message came in mobile category");
        // console.log(JSON.stringify(data, null, 2));
        let deviceId = data["device_id"];
        let sessionId = data["session_id"];
        let tabId = data["tab_id"];
		global.storeUserSocket(sessionId, tabId,socket);

        let message = data["message"];
        let message_type = data["user_type"];
        message = message.toLowerCase();
        message = message.split("-").join(" ");

        if(!sessions.isMobileSessionExist(sessionId, tabId))
        {
            sessions.createMobileSession(deviceId, sessionId, tabId);
        }
        mobile_bot.messageProcessing(sessionId, tabId, message, message_type);
    });
    socket.on("mobile_user_answers",function(data)
    {
        data = JSON.parse(data);
        console.log("mobile user answers");
        // console.log(JSON.stringify(data, null, 2));
        let deviceId = data["device_id"];
        let sessionId = data["session_id"];
        let tabId = data["tab_id"];
        global.storeUserSocket(sessionId, tabId,socket);

        let answers = data["keys"];
        let context = sessions.getMobileContext(sessionId, tabId);
        context["delay"] = 2000;
        context["user_type"] = "chat";
        let last_question_asked = context["unanswered_question"];
        //Storing the answer to the last question in context
        let question_answered = {};
        question_answered["type"] = "question_tag";
        question_answered["value"] = last_question_asked;
        question_answered["keys"] = answers;
        context["prev_questions"].push(question_answered);
        let new_questions_to_add_to_queue = [];
        for(let key in answers)
        {
            let answer_key = answers[key];
            let new_questions_key = last_question_asked + "_" + answer_key;
            if(mobile_conversationgraph.hasOwnProperty(new_questions_key))
            {
                let new_question = mobile_conversationgraph[new_questions_key];
                // console.log("Questions to add to the queue : ", new_question);
                new_questions_to_add_to_queue = new_questions_to_add_to_queue.concat(new_question);
            }

            let last_question = mobile_question_flow[last_question_asked];
            let attributes = last_question["attribute"];
            let order = last_question["order"];
            let last_question_text = last_question["options"][answer_key]["text"];
            let last_question_type = last_question["options"][answer_key]["type"];
            let last_answered_value = last_question["options"][answer_key]["value"];
            
            if(last_question_type=="feature")
            {
                if(!context.hasOwnProperty("feature_list"))
                    context["feature_list"] = [];
                if(context["feature_list"].indexOf(last_question_text)==-1)
                    context["feature_list"].push({"text":last_question_text,"value":last_answered_value,"suggestion_status":true});
                if(last_question_text=="all")
                {
                    new_questions_to_add_to_queue = [];
                    context["question_queue"] = [];
                    context["feature_list"] = [{"text":"overall","value":last_answered_value,"suggestion_status":true}]
                    break;
                }
            }
            else if(last_question_type=="percentile")
            {
                if(!context.hasOwnProperty("answered_questions"))
                    context["answered_questions"] = {};
                context["answered_questions"][last_question_asked] = {"percentage":last_answered_value,"attribute": attributes[0],"order":order,"suggestion_status":true};
            }
            else if(last_question_type=="screen")
            {
                if(!context.hasOwnProperty("answered_questions"))
                    context["answered_questions"] = {};
                context["answered_questions"][last_question_asked] = {"answer_key":answer_key,"answer_value":last_answered_value,"suggestion_status":true};
            }
            else if(last_question_type=="external_memory")
            {
                if(!context.hasOwnProperty("answered_questions"))
                    context["answered_questions"] = {};
                context["answered_questions"][last_question_asked] = {"selected_memory":last_answered_value,"suggestion_status":true};
            }
        }
        Array.prototype.unshift.apply(context['question_queue'], new_questions_to_add_to_queue);
        sessions.storeMobileContext(sessionId,tabId, context);
        mobile_bot.actions["findAllPhones"](sessionId, tabId);
    });
	socket.on("update_mobile_list", function(data)
	{
		data = JSON.parse(data);
		console.log("update mobile list");
		let deviceId = data["device_id"];
        let sessionId = data["session_id"];
        let tabId = data["tab_id"];
        let type = data["type"];
        global.storeUserSocket(sessionId, tabId,socket);
        let context = sessions.getMobileContext(sessionId, tabId);
        if(type=="show_more")
        {
            context["user_type"] = "show_more";
            let from = data["from"];
            if(context["from"]!=from)
                context["result_type"] = "showmore";

            context["from"] = from;
            let prev_function = context["prev_function"];
            mobile_bot.sendMobileList(sessionId, tabId, function(product_list, pref_message)
            {
                socket.emit("mobile_list", product_list);
            });
        }
	});
    /*setTimeout(sendHeartbeat,25000);
    function sendHeartbeat()
    {
        setTimeout(sendHeartbeat,25000);
        global.io.sockets.emit('ping',{ beat : 1 });
    }*/
});

/*
* this is helps to give the suggestions to the user
* @param {obj} req, res
* return {obj} suggestions  
*/
app.post('/message/autocomplete', function(req, res){
    let body = req.body;
    let message = body.message;
    
    let event_time = new Date().getTime();
    message = message.toLowerCase();
    message =  message.trim();
    // console.log(message);
    let sessionId = body["basic_info"]["session_id"];
    let tabId = body["basic_info"]["tab_id"];
    
    if(sessionId && tabId && message && message!="")
    {
        try{
            let context = sessions.getContext(sessionId, tabId);
            setTimeout(function(){
                let autocomplete_event = {
                    type : "autocomplete_message",
                    message : message,
                    chat_id : context["chat_id"],
                    time : event_time
                };
                helper.logger_api_call(sessionId, tabId, autocomplete_event, autocomplete_event["type"]);
            },1);
        }catch(e){}
    }

    let suggestions = {};
    suggestions["interpreted_question"] = "";
    suggestions["suggestions"] = [];
    let query = 
    {
        index : "autocomplete",
        type : "women_fashion",
        body : {
            "query":
            {
                "bool": {
                    "should": [
                       {
                           "match":{
                               "ngram_sentences":{
                                   "query": message,
                                   "analyzer":"autocomplete"
                               }
                           }
                       },
                       {
                           "match": {
                              "phrase_match_sentences": {
                                  "query": message,
                                  "operator": "and"
                              }
                           }
                       },
                       {
                            "prefix":{
                                "phrase_match_sentences":message
                            }
                       }
                    ]
                }
            }
        }
    };
    elasticSearch.runQuery(query, function (resp, total, err) {
        if(!err)
        {
            let hits = resp;
            hits = hits.splice(0,5);
            hits = hits.map(function(a){
                return a["_source"]["sentence"];
            });
            let obj = 
            {
                highlight : hits,
                rest : ""
            };
            suggestions["suggestions"].push(obj);
            try{
                autoComplete.getSuggestions(message, function (results) {
                    obj = {highlight:results["education_question"],rest:""};
                    suggestions["suggestions"].push(obj);
                    obj = {highlight:results["interpreted_question"],rest:""};
                    suggestions["suggestions"].push(obj);
                });
            }catch(e){}
            res.send(suggestions);
        }
    });
});
app.post('/message/bot_understood_message', function(req, res){
    console.log("Message in bot understood message api");
    let body = req.body;
    //console.log(JSON.stringify(body, null, 2));
    let message = body["message"];
    entity_bot.getEntities(message, undefined, function(entities){
        let templates = fashion_bot.getBotUnderstoodTemplate(entities);
        let bot_understood_message = "";
        if(templates.length>0)
        {
            bot_understood_message = templates[0];
        }
        res.send({message:bot_understood_message});
    });
});
/*
* This is used to send the inspirations to the user
* @param {obj} req, res
* return {obj} data  
*/
app.get('/message/inspirations/',function(req,res)
{
    // console.log("Sending Inspirations");
    // getting inspirations
    get_inspirations(function (result)
    {
        let slides_true = []
        let slides_false = []
        // seperating the banner images from the current list
        for (let i in result) {
            if (result[i]._source.slide) {
                slides_true.push(result[i])
            } else {
                slides_false.push(result[i])
            }
        }
        let data =
        {
            slides_true: slides_true,
            slides_false: slides_false
        }
        //Event Stroing =======================
        let inspiration_event = 
        {

        };
        res.send(data);
    });
});

/*
* If any message coming from the url, this api receives
* @param {obj} req, res
* return {obj} result -- based on the result_type the output is changes  
*/
app.post('/message/web/',function(req,res)
{
    let data = req.body;
    console.log("In web api...")
    let message = data['message'];
    let result_type = data["type"];
    let sessionId = data["session_id"];
    let tabId = data["tab_id"];
    
    message = message.split("-").join(" ");
    message = message.split("/").join(" ");
    message = message.toLowerCase();

    // console.log("Url message is ", message);
    let from = data['from'];
    if(!from)
        from = 0;

    website.webProcessMessage(message, from, result_type, function(result)
    {
        let event_time = new Date().getTime();
        //storing the events
    	setTimeout(function()
        {
    		if(result_type=="related_searches")
	        {
	            let event = 
	            {
	                type : "bot_response",
	                time : event_time,
	                details : 
	                {
	                    "type" : 'related_searches',
	                    "related_searches" : result.related_searches,
	                    "filter_list" : result.filter_list
	                }
	            };
	            //helper.logger_api_call(sessionId,tabId, event);
	        }
            else if(result_type=="content")
            {
                
            }
	        else
	        {
	        	try{
		            let product_list = JSON.parse(JSON.stringify(result["product_list"]));
		            if(product_list["list"])
		            {
		                let list = product_list["list"];
		                list = list.map(function(a)
		                {
		                    return { "id": a.id };
		                });
		                product_list["list"] = list;
		            }
		            let event = {
		                type : "bot_response",
		                time : event_time,
		                details : {
		                    type : 'products',
		                    product_list : product_list,
		                    benefits_message : result["benefits_message"]
		                }
		            };
		            //helper.logger_api_call(sessionId, tabId, event);
	        	}catch(e){}
	        }
    	},1);
        console.log("Sending response");
        res.send(result);
    });
});

app.post('/message/preferences/', function(req, res){
    let data = req.body;
    let event_time = new Date().getTime();
    // console.log("====================== In preferences")
    // console.log(data);
    let sessionId = data["session_id"];
    let deviceId = data["device_id"];
    let tabId = data["tab_id"];
    let type = data["type"];
    let added_filters = data["add_filters"];
    let remove_filters = data["remove_filters"];

    let context = sessions.getContext(sessionId, tabId);
    let product_line = mapping.product_line_to_db_keys[context["product_line"]];
    let filters = [];
    let benefits = context["benefits"];
    // let profile_benefits = helper.getProfileBenefits(sessionId, tabId);
    // benefits = benefits.concat(profile_benefits);
    let context_filters = context["filters"].concat();
    if(remove_filters)
    {
        for(let i in remove_filters)
        {
            let attribute = remove_filters[i].key;
            let values = remove_filters[i].values;
            if(attribute=="discount_price" || attribute=="discount_percent")
            {
                for(let cf in context_filters)
                {
                    let cf_key = Object.keys(context_filters[cf])[0];
                    if(cf_key=="range")
                    {
                        if(context_filters[cf]["range"].hasOwnProperty(attribute))
                        {
                            context_filters.splice(cf, 1);
                            break;
                        }
                    }
                }
            }
            else
            {
                for(let j in values)
                {
                    let val = values[j];
                    for(let cf in context_filters)
                    {
                        let cf_key = Object.keys(context_filters[cf])[0];
                        if(cf_key=="product_filter."+attribute && context_filters[cf][cf_key]==val)
                        {
                            context_filters.splice(cf, 1);
                            break;
                        }
                    }
                }
            }
        }
    }
    if(added_filters)
    {
        for(let i in added_filters)
        {
            let key = added_filters[i].key,values = added_filters[i].values;
            if(key=="discount_price")
            {
                let c_filters = context_filters.concat();
                for(let cf in c_filters)
                {
                    let att_name = c_filters[cf];
                    if(att_name.hasOwnProperty("range"))
                    {
                        if(att_name["range"].hasOwnProperty("product_filter.discount_price"))
                        {
                            context_filters.splice(cf, 1);
                        }
                    }
                }
                let numbers = values[0].match(/[-]{0,1}[\d.]*[\d]+/g);
                let obj = {"range":{"product_filter.discount_price":{}}};
                if(numbers.length==2)
                {
                    obj.range["product_filter.discount_price"].gte = numbers[0];
                    obj.range["product_filter.discount_price"].lte = numbers[1];
                }
                else
                {
                    obj.range["product_filter.discount_price"].gte = numbers[0];
                }
                filters.push(obj);
            }
            else if(key=="discount_percent")
            {
                for(let cf in c_filters)
                {
                    let att_name = c_filters[cf];
                    if(att_name.hasOwnProperty("range"))
                    {
                        if(att_name["range"].hasOwnProperty("product_filter.discount_percent"))
                        {
                            context_filters.splice(cf, 1);
                        }
                    }
                }
                let percentage = values[0].match(/[-]{0,1}[\d.]*[\d]+/g);
                let obj = {"range":{"product_filter.discount_percent":{}}};

                if(values[0].indexOf("more")!=-1)
                {
                    obj.range["product_filter.discount_percent"].gte = percentage[0];
                }
                else
                {
                    obj.range["product_filter.discount_percent"].lte = percentage[0];
                }
                filters.push(obj);
            }
            else
            {
                for(let j in values)
                {
                    let obj = {};
                    obj["product_filter."+key] = values[j];
                    filters.push(obj);
                }
            }
        }
        filters = filters.concat(context_filters);
    }
    if(type=="no_need")
    {
        let event = {
            "type":"user_selected_message",
            "chat_id":context["chat_id"],
            "time":event_time,
            "product_line":context["product_line"]
        };
        
        if(context["preference_question_type"] == "profile_question" || context["preference_question_type"]=="recommend_profile_filters")
        {
            offline.sendBodyProfileQuestionsToUser(sessionId, tabId, "body_concerns_question");
        }
        else if(context["preference_question_type"] == "body_concerns_question" || context["preference_question_type"] == "recommend_bodyconcern_filters")
        {
            offline.sendBodyProfileQuestionsToUser(sessionId, tabId, "last_message");
        }
        res.send({});
    }
    else if(type=="recommend_preferences")
    {
    	let context_filters = filters.concat();
    	let adjective_values = context["adjectives_new"].concat(context["priority_values"]["adjectives"]);
    	let adjective_filters = helper.getAdjectiveFilters(product_line, adjective_values,[]);
    	for(let i in adjective_filters)
    	{
    		let db_key = "product_filter."+adjective_filters[i]["key"]
    		let adj_filters = adjective_filters[i]["values"].map(function(a){
    			let obj = {};
    			obj[db_key] = a;
    			return obj;
    		});
    		context_filters = context_filters.concat(adj_filters);
    	}
        let conflict_benefits = context["conflict_benefits"];
        let applied_filters = offline.getAppliedFilters(context_filters);
        let priority_values = JSON.parse(JSON.stringify(context["priority_values"]));
    	priority_values["adjectives"] = [];
        filterList.getFilterCount(product_line, context_filters, priority_values, benefits, [],context["remove_tags"], function(result)
        {
        	filterList.getRecommendedPreferences(product_line, result, conflict_benefits,applied_filters, function(filter_result)
            {
                let filter_data = {};
                filter_data.type = "filter_list";
                filter_data.product_line = product_line;
                filter_data.options = filter_result;

                res.send(filter_data);
            });
        });
    }
    else if(type=="applied_recommend_preferences")
    {
    	let context_filters = filters.concat();
    	let adjective_values = context["adjectives_new"].concat(context["priority_values"]["adjectives"]);
    	let adjective_filters = helper.getAdjectiveFilters(product_line, adjective_values,[]);
    	for(let i in adjective_filters)
    	{
    		let db_key = "product_filter."+adjective_filters[i]["key"]
    		let adj_filters = adjective_filters[i]["values"].map(function(a){
    			let obj = {};
    			obj[db_key] = a;
    			return obj;
    		});
    		context_filters = context_filters.concat(adj_filters);
    	}
        context["adjectives_new"] = [];
        context["priority_values"]["adjectives"] = [];

        context["filters"] = context_filters;
        sessions.storeContext(sessionId, tabId, context);
        if(context["preference_question_type"]=="recommend_profile_filters")
            offline.sendBodyProfileQuestionsToUser(sessionId, tabId, "body_concerns_question");
        else
            offline.sendBodyProfileQuestionsToUser(sessionId, tabId, "last_message");
        res.send({});
    }
    else
    {
        filterList.getFilterCount(product_line, filters, context["priority_values"], benefits, context["adjectives_new"],context["remove_tags"], function(result)
        {
            // console.log("---------------------------");
            let filter_data = {};
            filter_data.type = "filter_list";
            filter_data.product_line = product_line;
            filter_data.options = result;
            let response_time = new Date().getTime();
            // console.log("Returning api ------------------>");
            res.send(filter_data);
        });
    }
});
/*
* While user making the request for products this api calls
* @param {obj} req, res
* return {obj} products_data  
*/
app.post('/message/getproducts/',function(req,res)
{
    let event_time = new Date().getTime();
    let data = req.body;
    // console.log("In Get Products api ********************************");
    // console.log(data, typeof data);
    let sessionId = data['session_id'];
    let tab_id = data["tab_id"];
    let page_no = data['page_no'];
    let sort_type = data["sort_type"];

    let context = sessions.getContext(sessionId, tab_id); // getting the current user context
    if(sort_type) // checking the sort type is existed or not
    {
        context["sort_type"] = sort_type;
        let priority_values = [];
        if(sort_type=="priority") // if sort type is priority getting the priority value
        {
            priority_values = data["priority_values"];
            context["sort_priority_values"] = priority_values;
        }
        setTimeout(function(){
            // Event Storing ========================
            let sort_event = 
            {
                type : "sort_applied",
                time : event_time,
                chat_id : context.chat_id,
                sort_type : sort_type,
                priority_values : JSON.stringify(priority_values)
            };
            helper.logger_api_call(sessionId,tab_id, sort_event, sort_event["type"]);
            // +++===================================
        },1);
    }
    //setting the page number in context
    context["from"] = 0;
    if(page_no)
        context["from"] = page_no;
    sessions.storeContext(sessionId, tab_id, context);

    offline.sendProductsToUser(sessionId, tab_id, function(products_data) // getting the products based on the current user context
    {
        let response_time = new Date().getTime();
        if(data["refresh_button"] || context["is_flow_complete"]) // if user clicked on the refresh_button or the chat flow complete storing the event 
        {
            setTimeout(function(){
                // Event Storing ========================
                let web_event = 
                {
                    type : "on_product_page",
                    time : event_time,
                    chat_id : context.chat_id,
                    total_products : products_data.product_list.total_length
                };
                helper.logger_api_call(sessionId, tab_id, web_event, web_event["type"]);
                // +++===================================
            },1);
        }

    	setTimeout(function(){
    		let product_list = JSON.parse(JSON.stringify(products_data.product_list));
	        //Event Storing ===================================
	        let events = {
	            type:"getproducts_response", 
	            time : response_time, 
	            chat_id : context.chat_id, 
	            details : product_list
	        };
	        events.details.type = "product_list";
	        for(let i in product_list.list)
	        {
	            let product_details ={};
	            product_details["id"] = product_list.list[i].id;
	            product_details["benefit_percentage"] = product_list.list[i].benefit_percentage;
	            events.details.list[i] = product_details;
	        }
	        helper.logger_api_call(sessionId, tab_id, events, events["type"]);
	        //==================================================
    	},1);
        // sending the product list
        try{
	        console.log("Sending products : ", products_data.product_list.list.length);
	    }catch(e){};
        res.send(products_data);
    });
});
/*
* While user making the request for benefits this api calls
* @param {obj} req, res
* return {obj} benefit_list  
*/
app.post('/message/getbenefits/',function(req,res)
{
    let data = req.body;
    // console.log("In Get Benefits Api ********************************");
    let sessionId = data['session_id'];
    let tab_id = data["tab_id"];
    try{
        let context = sessions.getContext(sessionId, tab_id); // getting the user context
        offline.sendBenefitsToUser(sessionId,tab_id,function(benefit_list) // getting the benefits data based on the current user context
        {
            let response_time = new Date().getTime();
        	setTimeout(function(){
        		let events = {
	                type:"getbenefits_response", 
	                time : response_time, 
	                chat_id : context["chat_id"], 
	                details:benefit_list
	            };
	            events.details.type = "benefit_list";
	            helper.logger_api_call(sessionId, tab_id, events, events["type"]);
        	},1);
            // sending the benefits_list
            res.send({"benefit_list":benefit_list});
        });
    }catch(e)
    {
        console.log(e);
        res.send({"benefit_list":{}});
    }
});
/*
* While user making the request for filters this api calls
* @param {obj} req, res
* return {obj} filter_data  
*/
app.post('/message/getfilters/',function(req,res)
{
    let event_time = new Date().getTime();
    console.log("=============== Get filters Api");
    let data = req.body;
    // console.log(JSON.stringify(data, null, 2));
    let sessionId = data["session_id"];
    let tab_id = data["tab_id"];
    let type = data["type"]; // current action type

    let added_filters = data["add_filters"];
    let remove_filters = data["remove_filters"];

    // console.log("Added Filters :",JSON.stringify(added_filters, null, 2));
    // console.log("Removed Filters :",JSON.stringify(remove_filters, null,2));
    try{
        let context = sessions.getContext(sessionId, tab_id); // getting the user context
        if(context.product_line)
        {
            let filters_event = 
            {
                type : "filters_applied",
                time : event_time,
                chat_id : context.chat_id,
                details : 
                {
                	added_filters : added_filters,
                	removed_filters : remove_filters
                }
            };
            let context_filters = context["filters"].concat();
            // removing the filters from the context
            if(remove_filters)
            {
            	for(let i in remove_filters)
            	{
            		let attribute = remove_filters[i].key;
            		let values = remove_filters[i].values;
            		if(attribute=="discount_price" || attribute=="discount_percent")
            		{
            			for(let cf in context_filters)
            			{
            				let cf_key = Object.keys(context_filters[cf])[0];
            				if(cf_key=="range")
            				{
            					if(context_filters[cf]["range"].hasOwnProperty(attribute))
            					{
            						context_filters.splice(cf, 1);
            						break;
            					}
            				}
            			}
            		}
            		else
            		{
    	        		for(let j in values)
    	        		{
    	        			let val = values[j];
    	        			for(let cf in context_filters)
    	        			{
    	        				let cf_key = Object.keys(context_filters[cf])[0];
    	        				if(cf_key=="product_filter."+attribute && context_filters[cf][cf_key]==val)
    	        				{
    	        					context_filters.splice(cf, 1);
    	        					break;
    	        				}
    	        			}
    	        		}
    	        		// console.log("Context filters : After removing some filters :");
    	        		// console.log(context_filters);
    	        	}
            	}
            }
            let filters = [];
            // adding the filter to the context
            if(added_filters)
            {
                for(let i in added_filters)
                {
                    let key = added_filters[i].key,values = added_filters[i].values;
                    if(key=="discount_price")
                    {
                        let c_filters = context_filters.concat();
                        for(let cf in c_filters)
                        {
                            let att_name = c_filters[cf];
                            if(att_name.hasOwnProperty("range"))
                            {
                                if(att_name["range"].hasOwnProperty("product_filter.discount_price"))
                                {
                                    context_filters.splice(cf, 1);
                                }
                            }
                        }
                        let numbers = values[0].match(/[-]{0,1}[\d.]*[\d]+/g);
                        let obj = {"range":{"product_filter.discount_price":{}}};
                        if(numbers.length==2)
                        {
                            obj.range["product_filter.discount_price"].gte = numbers[0];
                            obj.range["product_filter.discount_price"].lte = numbers[1];
                        }
                        else
                        {
                            obj.range["product_filter.discount_price"].gte = numbers[0];
                        }
                        filters.push(obj);
                    }
                    else if(key=="discount_percent")
                    {
                        for(let cf in c_filters)
                        {
                            let att_name = c_filters[cf];
                            if(att_name.hasOwnProperty("range"))
                            {
                                if(att_name["range"].hasOwnProperty("product_filter.discount_percent"))
                                {
                                    context_filters.splice(cf, 1);
                                }
                            }
                        }
                        let percentage = values[0].match(/[-]{0,1}[\d.]*[\d]+/g);
                        let obj = {"range":{"product_filter.discount_percent":{}}};

                        if(values[0].indexOf("more")!=-1)
                        {
                            obj.range["product_filter.discount_percent"].gte = percentage[0];
                        }
                        else
                        {
                            obj.range["product_filter.discount_percent"].lte = percentage[0];
                        }
                        filters.push(obj);
                    }
                    else
                    {
                        for(let j in values)
                        {
                            let obj = {};
                            obj["product_filter."+key] = values[j];
                            filters.push(obj);
                        }
                    }
                }
            }
            filters = filters.concat(context_filters);
            // console.log("^^^^^^^^^^^^^^^^ Sending Filters for "+context["product_line"]+" ^^^^^^^^^^^^^^^^^^");
            let product_line = mapping.product_line_to_db_keys[context["product_line"]];
            let benefits = context['benefits'].concat();
            // let profile_benefits = helper.getProfileBenefits(sessionId, tab_id);
            // benefits = benefits.concat(profile_benefits);

            if(type=="filters") // if type is filters save the current filter list in the user context
            {
                let context = sessions.getContext(sessionId, tab_id);
                helper.logger_api_call(sessionId,tab_id, filters_event, filters_event["type"]);
                context.filters = filters;
                sessions.storeContext(sessionId,tab_id, context);
            }
            filterList.getFilterCount(product_line, filters, context["priority_values"], benefits, context["adjectives_new"],context["remove_tags"], function(result)
            {
                // console.log("---------------------------");
                let filter_data = {};
                filter_data.type = "filter_list";
                filter_data.product_line = product_line;
                filter_data.options = result;
                let response_time = new Date().getTime();
                setTimeout(function(){
                    // Event Storing =================================
                    let events = {
                        type:"filters_response",
                        request_type : type,
                        time : response_time,
                        chat_id : context["chat_id"], 
                        details: filter_data
                    };
                    helper.logger_api_call(sessionId, tab_id, events, events["type"]);
                    //================================================
                }, 1);
                // console.log("Returning api");
                res.send(filter_data);
            });
        }
        else{res.send({});}
    }
    catch(e){
    	console.log(e);
    	res.send({})
    }
});

/*
* While user making the request for brands this api calls
* @param {obj} req, res
* return {obj} brand_data  
*/
app.post('/message/shopbybrands/',function(req,res)
{
    let body = req.body;
    // console.log(JSON.stringify(body, null, 2));
    let req_product_line = req.body.productline;
    req_product_line = req_product_line.split("-").join(" ");
    let sessionId = req.body["session_id"];
    let deviceId = req.body["device_id"];
    let tabId = req.body["tab_id"];
    let product_line = mapping.product_line_to_db_keys[req_product_line];
    filterList.get_product_line_filters(product_line, function(options)
    {
        let brand = options.filter(function(attribute)
        {
            return attribute.key=="brand";
        });
        let response_time = new Date().getTime();
        setTimeout(function(){
        	if(sessionId)
	        {
		        let events = {
		            type:"shopbybrands_response", 
		            time : response_time, 
		            product_line : req_product_line, 
		            details:
		            {
		                type:"shopbybrands",
		                results : brand
		            }
		        };
		        helper.logger_api_call(sessionId,tabId, events,events["type"]);
		    }
        },1);
        res.send({"brand":brand});
    });
});

/*
* While user add or removing the benefits this is api call
* @param {obj} req, res
* return {obj} updated_result  
*/
app.post('/message/updateproducts/',function(req,res)
{
    let event_time = new Date().getTime();
    let data = req.body;
    // console.log("********************** Updating products ************************");
    // console.log(data);
    // console.log("*****************************************************************")
    let sessionId = data["session_id"];
    let tab_id = data["tab_id"];
    let context = sessions.getContext(sessionId, tab_id);
    let type = data.type;
    if(type=="remove") // user removed the only one filter from the benefit list or adjective list
    {
    	let benefit_to_be_remove = data.benefit_to_be_removed;
        context.remove_tags.push(benefit_to_be_remove); // pushing the user removed benefit into remove_tags
        setTimeout(function(){
        	//Event Storing ==========================================
	        let remove_benefit_event =
	        {
	            type : "clicked_on_remove_benefit",
	            time : event_time,
	            chat_id : context.chat_id,
	            details : benefit_to_be_remove
	        }; 
	        helper.logger_api_call(sessionId,tab_id, remove_benefit_event,remove_benefit_event["type"]);
	        //========================================================
        },1);
    }
    else if(type=="add_more_benefits") // if user is added or removed some benefit or adjective from the list
    {
    	let benefit_to_be_remove = data.benefit_to_be_removed;
        let benefit_to_be_added = data.benefit_to_be_added;
        setTimeout(function(){
        	//Event Storing ==========================
	        let benefits_applied_event =
	        {
	            type : "benefits_applied",
	            time : event_time,
	            chat_id : context.chat_id,
	            details : {
	            	removed_benefits : benefit_to_be_remove,
	            	added_benefits : benefit_to_be_added
	            }
	        }; 
	        helper.logger_api_call(sessionId,tab_id, benefits_applied_event,benefits_applied_event["type"]);
	        //=======================================
        },1);

        let remove_tags = context.remove_tags.concat();
        for(let i in benefit_to_be_added)
        {
            context.benefits.push(benefit_to_be_added[i].value); // saving the added benefit into the user context
            for(let j in remove_tags) // and removing the added benefit from the remove tags list in the context
            {
                let type = remove_tags[j].type;
                let value = remove_tags[j].value;
                if(value == benefit_to_be_added[i].value)
                {
                    remove_tags.splice(j,1);
                }
            }
        }

        // console.log("Removed benefits : ", remove_tags);
        let pri_value_count = 0;
        for(let i in benefit_to_be_remove) // adding the user removed benefits from the remove tags in the user context
        {
            remove_tags.push(benefit_to_be_remove[i]);
            let index = context["benefits"].indexOf(benefit_to_be_remove[i].value); // removing the benefit value from the context benefits list
            let pri_index = context["priority_values"]["benefits"].indexOf(benefit_to_be_remove[i].value); // removing the benefit value from the high priority benefits list
            if(index!=-1)
            {
                context["benefits"].splice(index, 1);
            }
            if(pri_index!=-1)
            {
                context["priority_values"]["benefits"].splice(pri_index-pri_value_count,1);
                pri_value_count++;
            }
        }
        context.remove_tags = remove_tags;
    }
    sessions.storeContext(sessionId,tab_id, context);
    offline.updateProductList(sessionId,tab_id,function(updated_result) // updating the current product list and sending to the user
    {
        let response_time = new Date().getTime();
    	setTimeout(function(){
    		//Event Storing =======================================
	    	let product_list = JSON.parse(JSON.stringify(updated_result.product_list));
	        let events = {
	            type:"getproducts_response",
	            time : response_time, 
	            chat_id : context.chat_id, 
	            details:product_list
	        };
	        events.details.type = "product_list";
	        for(let i in product_list.list)
	        {
	            let product_details ={};
	            product_details["id"] = product_list.list[i].id;
	            product_details["benefit_percentage"] = product_list.list[i].benefit_percentage;
	            events.details.list[i] = product_details;
	        }
	        helper.logger_api_call(sessionId,tab_id, events, events["type"]);
	        //=====================================================
    	},1);
        res.send(updated_result)
    });
});

/*
* user clicks on any product this api calls
* @param {obj} req, res
* return {obj} source  
*/
app.get('/message/:productline/:id',function(req, res)
{
    let req_product_line = req.params.productline;
    req_product_line = req_product_line.split("_").join(" ");
    let product_line = mapping.product_line_to_db_keys[req_product_line];
    let id = req.params.id;
    // console.log(product_line, id);
    if(!product_line || !id)
    {
        res.send({}); 
    }
    /*let query = 
    {
        index : "product_data",
        type  : product_line,
        body : {
            query:{match_phrase:{_id:id}}
        }
    }*/
    let mongo_query = {es_mysql_id : parseInt(id)};
    //elasticSearch.runQuery(query,function(response,total,err)
    mongo.runQuery(product_line, mongo_query, function(response, err)
    {
        let total = response.length;
        // console.log("total : ",total,"err : ",err);
        if(err==null && total!=0)
        {
            let resp_source = response[0];
            let source = {};
            source["id"] = resp_source["es_mysql_id"];
            source["product_filter"] = resp_source["product_filter"];
            source["style_image"] = resp_source["style_images"];
            if(!source["style_image"])
                source["style_image"] = resp_source["style_image"];
            source["product_benefits"] = offline.getElementsNames(resp_source["benefits"],req_product_line,"benefits");
            source["product_benefits"] = source["product_benefits"].concat(offline.getElementsNames(resp_source["adjectives"],req_product_line, "adjectives"));
            source["landingPageUrl"] = resp_source["pdpData"]["landingPageUrl"];
            if(!source["style_image"].hasOwnProperty("search"))
                source["style_image"]["search"] = source["style_image"]["default"];
            /*let events = {
                name:"productpage_response", 
                time : new Date().getTime(), 
                product_line : req_product_line, 
                details:source
            };
            helper.logger_api_call(sessionId,tab_id, events) ;*/
            res.send(source);
        }
        else
            res.send({});
    });
});
/*
* Sending the adjectives data to the user given attributes
* @param {obj} req, res
* return {obj} updated_result  
*/
app.post('/message/adjectives/', function (req, res)
{
    let body = req.body;
    let sessionId = body["session_id"];
    let deviceId = body["device_id"];
    let tabId = body["tab_id"];
    let attributes = body.attributes;
    let product_line = body.product_line;
    let query = 
    {
        "index": "styling_rules",
        "type" : "adjectives_rules",
        "body" : 
        {"query":{"bool":{"must":[],"should":[]}},size:10000}
    };
    // making the elastic search query
    query.body.query.bool.must.push({"match_phrase":{"product_line_name":product_line}});
    var bool_query = 
    {
        "bool":{"should":[]}
    }
    for(var i in attributes)
    {
        bool_query.bool.should.push({"match_phrase":{"attribute_dependencies.attribute_type":attributes[i]}});
    }
    query.body.query.bool.must.push(bool_query);
    // getting the data from the elastic search
    elasticSearch.runQuery(query,function (hits, total,status) {
        if (status){
          // console.log("search error: "+error)
        }
        else {
          var result = {};
          for(var i in hits)
          {
            var attribute_type = hits[i]._source.attribute_dependencies[0].attribute_type;
            if(!result.hasOwnProperty(attribute_type))
            {
                result[attribute_type] = [];
            }
            result[attribute_type].push(hits[i]._source.adjective_display_name);
          }
          if(sessionId && tabId)
          {
          	let adjective_event =
          	{
          		type : "adjective_response",
          		time : new Date().getTime(),
          		details : result
          	};
          	//sessions.logger_api_call(sessionId, tabId, adjective_event);
          }
          //sending the response
          res.send(result);
        }
    });
});
/*
* Sending the login response
* @param {obj} req, res
* return {obj} resp_obj  
*/
app.post("/message/login",function(req,res)
{
    let resp_obj = {status:false,data:{},error:""};
    let query="";
    let source_body = req.body;
    // console.log("`````````````````````````````````````");
    // console.log("Source Body : ",source_body);
    // console.log("`````````````````````````````````````");
	let sessionId = source_body["basic_info"]["session_id"];
    let tab_id = source_body["basic_info"]["tab_id"];
    let request_type = source_body.request_type;
    if(request_type=="google") // login request from the google
    {
        //google login
        let status = true;
        // console.log("Request : Google Login");
        let google_data = source_body.google_data;
        
        
        let email = google_data.email
        let google_id = google_data.google_id;
        let username = google_data.username;
        let profile_pic = google_data.profile_pic;
        if(email==undefined || email=="")
        {
            status = false;
            resp_obj.status = false;
            resp_obj.error = "Email is empty";
            let response_time = new Date().getTime();
            setTimeout(function(){
            	if(sessionId && tab_id)
	            {
		            let login_event = {
		            	type : "login_response",
		            	login_type : "google",
		            	time : response_time,
		            	details : resp_obj
		            }
		            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
		        }
            },1);
        }

        if(status)
        {
            query = "select * from users where email='"+email+"'";
            dbQueries(query,"selekt",function(data)
            {
                // console.log("User Data length : ",data.length);
                if(data.length>0)// already user is existed in our current database
                {
                    let user_id = data[0].user_id;
                    // console.log(user_id);
                    let google_query = "select * from google_users where user_id='"+user_id+"'";
                    dbQueries(google_query,"selekt",function(google_resp)
                    {
                        if(google_resp.length==0) // google data is not present in our database to this user
                        {
                            let insert_google_users = "insert into google_users(user_id,google_id,email,username,profile_pic) values('"+user_id+"','"+google_id+"','"+email+"','"+username+"','"+profile_pic+"')";
                            dbQueries(insert_google_users,"selekt",function(google_insert_resp)
                            {
                                // console.log("New Google User added.");
                            });
                        }
                    });

                    resp_obj = get_obj(data[0]);
                    if(sessionId)
		            {
		            	let web_user_details = sessions.getUserDetails(sessionId);
		            	web_user_details["user_id"] = user_id;
		            	sessions.createUserDetails(sessionId, web_user_details);
                        let response_time = new Date().getTime();
		            	setTimeout(function(){
		            		//Event Storing =============================
				            let login_event = {
				            	type : "login_response",
				            	login_type : "google",
				            	time : response_time,
				            	details : resp_obj
				            }
				            helper.logger_api_call(sessionId,tab_id, login_event,login_event["type"]);
				            //===========================================
		            	},1);
		            	
			        }
                    // sending the response
                    res.send(resp_obj);
                }
                else
                {
                    // new google user to our website
                    let user_insert_query = "insert into users(username,email) values('"+username+"','"+email+"')";
                    dbQueries(user_insert_query,"selekt",function(user_insert_resp)
                    {
                        let userid_query = "select * from users where email="+email;
                        dbQueries(userid_query,"selekt",function(query_resp)
                        {
                            let user_id = query_resp[0].user_id;
                            //=======================================================================
                            let insert_google_users = "insert into google_users(user_id,google_id,email,username,profile_pic) values('"+user_id+"','"+google_id+"','"+email+"','"+username+"','"+profile_pic+"')";
                            dbQueries(insert_google_users,"selekt",function(google_insert_resp)
                            {
                                // console.log("New Google User added.");
                                dbQueries("select * from users where user_id='"+user_id+"'","selekt",function(response)
                                {
                                    resp_obj = get_obj(response[0]);
                                    if(sessionId)
						            {
						            	let web_user_details = sessions.getUserDetails(sessionId);
						            	web_user_details["user_id"] = user_id;
						            	sessions.createUserDetails(sessionId, web_user_details);
                                        let response_time = new Date().getTime();
						            	setTimeout(function(){
						            		//Event Storing =============================
								            let login_event = {
								            	type : "login_response",
								            	login_type : "google",
								            	time : response_time,
								            	details : resp_obj
								            }
								            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
								            //===========================================
						            	},1);
							        }
                                    res.send(resp_obj);
                                });
                            });
                        });
                    });
                }
            });
        }
    }
    else if(request_type=="fb") // logic request from the facebook
    {
        //facebook login
        // console.log("Request : Facebook Login");
        let fb_data = source_body.fb_data;
        
        let email = fb_data.email;
        let fb_id = fb_data.fb_id;
        let username = fb_data.username;
        let profile_pic = fb_data.profile_pic;

        let status = true;

        if(email==undefined || email=="")
        {
            status = false;
            resp_obj.status = false;
            resp_obj.error = "Email is empty";
            if(sessionId && tab_id)
            {
                let response_time = new Date().getTime();
            	setTimeout(function(){
            		//Event Storing =============================
		            let login_event = {
		            	type : "login_response",
		            	login_type : "facebook",
		            	time : response_time,
		            	details : resp_obj
		            }
		            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
		            //===========================================
            	},1);
            	
	        }
            res.send(resp_obj);
        }
        if(fb_id==undefined || fb_id=="")
        {
            status = false;
            resp_obj.status = false;
            resp_obj.error = "Facebook id is empty";
            if(sessionId && tab_id)
            {
                let response_time = new Date().getTime();
            	setTimeout(function(){
            		//Event Storing =============================
		            let login_event = {
		            	type : "login_response",
		            	login_type : "facebook",
		            	time : response_time,
		            	details : resp_obj
		            }
		            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
		            //===========================================
            	},1);
	        }
            res.send(resp_obj);
        }
        if(status)
        {
            query = "select * from users where email='"+email+"'";
            dbQueries(query,"selekt",function(data)
            {
                if(data.length>0) // already existed user in our database
                {
                    let facebook_query = "select * from fb_users where user_id='"+data[0].user_id+"'";
                    let user_id = data[0].user_id;
                    //=======================================================================
                    dbQueries(facebook_query,"selekt",function(fb_resp)
                    {
                        if(fb_resp.length==0) // facebook data not present in our database
                        {
                            let insert_facebook_users = "insert into fb_users(user_id,fb_id,email,username,profile_pic) values('"+user_id+"','"+fb_id+"','"+email+"','"+username+"','"+profile_pic+"')";
                            dbQueries(insert_facebook_users,"selekt",function(facebook_insert_resp)
                            {
                                // console.log("New Facebook User added.");
                            });
                        }
                    });

                    resp_obj = get_obj(data[0]);
                    if(sessionId && tab_id)
		            {
		            	let web_user_details = sessions.getUserDetails(sessionId);
		            	web_user_details["user_id"] = user_id;
		            	sessions.createUserDetails(sessionId, web_user_details);
                        let response_time = new Date().getTime();
		            	setTimeout(function(){
		            		//Event Storing =============================
				            let login_event = {
				            	type : "login_response",
				            	login_type : "facebook",
				            	time : response_time,
				            	details : resp_obj
				            }
				            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
				            //===========================================
		            	},1);
		            	
			        }
                    res.send(resp_obj);
                }
                else
                {
                    let user_insert_query = "insert into users(username,email) values('"+username+"','"+email+"')";
                    dbQueries(user_insert_query,"selekt",function(user_insert_resp)
                    {
                        let userid_query = "select * from user where email="+email;
                        dbQueries(userid_query,"selekt",function(userid_resp)
                        {
                            let user_id = userid_resp[0]["user_id"];
                            //=======================================================================
                            let insert_facebook_users = "insert into fb_users(user_id,fb_id,email,username,profile_pic) values('"+user_id+"','"+fb_id+"','"+email+"','"+username+"','"+profile_pic+"')";
                            dbQueries(insert_facebook_users,"selekt",function(facebook_insert_resp)
                            {
                                dbQueries("select * from users where user_id='"+user_id+"'","selekt",function(response)
                                {
                                    resp_obj = get_obj(response[0]);
                                    if(sessionId && tab_id)
						            {
						            	let web_user_details = sessions.getUserDetails(sessionId);
						            	web_user_details["user_id"] = user_id;
						            	sessions.createUserDetails(sessionId, web_user_details);
                                        let response_time = new Date().getTime();
						            	setTimeout(function(){
						            		//Event Storing =============================
								            let login_event = {
								            	type : "login_response",
								            	login_type : "facebook",
								            	time : response_time,
								            	details : resp_obj
								            }
								            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
								            //===========================================
						            	},1);
						            	
							        }
                                    res.send(resp_obj);
                                });
                            });
                            
                        });
                    });
                }
            });
        }
    }
    else if(request_type=="manual") // manual login request
    {
        // console.log("Request : Manual Login");
        let manual_data = source_body.manual_data;
        
        let email = manual_data.email;
        let password = manual_data.password;

        query = "select * from users where email='"+email+"' and password='"+password+"'";
        dbQueries(query,"selekt",function(result)
        {
            if(result.length>0) // already existed user in our database
            {
                let require_res = result[0];
                let user_id = require_res["user_id"];
                //=======================================================================
                resp_obj = get_obj(require_res);
                if(sessionId && tab_id)
	            {
	            	let web_user_details = sessions.getUserDetails(sessionId);
	            	web_user_details["user_id"] = user_id;
	            	sessions.createUserDetails(sessionId, web_user_details);
                    let response_time = new Date().getTime();
	            	setTimeout(function(){
	            		//Event Storing =============================
			            let login_event = {
			            	type : "login_response",
			            	login_type : "manual",
			            	time : response_time,
			            	details : resp_obj
			            }
			            helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
			            //===========================================
	            	},1);
		        }
                res.send(resp_obj);
            }
            else
            {
                resp_obj.status = false;
                resp_obj.error = "Invalid Credentials";
                if(sessionId && tab_id)
	            {
                    let response_time = new Date().getTime();
	            	setTimeout(function(){
	            		//Event Storing =============================
			            let login_event = {
			            	type : "login_response",
			            	login_type : "manual",
			            	time : response_time,
			            	details : resp_obj
			            }
			            helper.logger_api_call(sessionId,tab_id, login_event, login_event[""]);
			            //===========================================
	            	},1);
	            	
		        }
                res.send(resp_obj);
            }
        });
    }
    else // some error request
    {
        let resp_obj = {};
        resp_obj.status = false;
        resp_obj.error = "Invalid Request";
        if(sessionId && tab_id)
	    {
            let response_time = new Date().getTime();
	    	setTimeout(function(){
	    		//Event Storing =============================
		        let login_event = {
		        	type : "login_response",
		        	login_type : "error",
		        	time : response_time,
		        	details : resp_obj
		        }
		        helper.logger_api_call(sessionId,tab_id, login_event, login_event["type"]);
		        //===========================================
	    	},1);
	    }
        res.send(resp_obj);
    }
});
/*
* Sending the signup response to the user
* @param {obj} req, res
* return {obj} resp_obj  
*/
app.post("/message/signup",function(req,res) 
{
    let resp_obj =
    {
        "status":false,
        "data" :{},
        "error" : ""
    };
    // console.log("In Signup Api ====================");
    // console.log(req.body);
    let body = req.body;
    let state = true;
    let string = "";

    let sessionId = body["basic_info"]["session_id"];
    let tab_id = body["basic_info"]["tab_id"];

    let username = body.username;
    let email = body.email;
    let mobile_no = body.mobile_number;
    let password = body.password;
    if(username.length==0)
    {
        state = false;
        string ="Username Empty";
    }
    else if(email.length==0)
    {
        state = false;
        string = "Email Empty";
    }

    if(!state)
    {
        resp_obj.status = false;
        resp_obj.error = string;
        if(sessionId && tab_id)
        {
            let response_time = new Date().getTime();
        	setTimeout(function(){
        		//Event Storing =============================
	            let signup_event = {
	            	type : "signup_response",
	            	time : response_time,
	            	details : resp_obj
	            }
	            helper.logger_api_call(sessionId,tab_id, signup_event, signup_event["type"]);
	            //===========================================
        	},1);
        	
        }
        res.send(resp_obj);
    }
    else
    {
        let query = "select * from users where email='"+email+"'";
        dbQueries(query,"selekt",function(data)
        {
            if(data.length==0)
            {
                let insert_query = "insert into users(username,email,mobile_number,password) values('"+email+"','"+email+"','"+mobile_no+"','"+password+"')"
                dbQueries(insert_query,"selekt",function(result)
                {
                    let getting_info = "select * from users where email='"+email+"' and password='"+password+"'";
                    dbQueries(getting_info,"selekt",function(result)
                    {
                    	let user_id = result[0]["user_id"];
                        resp_obj = get_obj(result[0]);
                        if(sessionId && tab_id)
				        {
				        	let web_user_details = sessions.getUserDetails(sessionId);
				        	web_user_details["user_id"] = user_id;
				        	sessions.createUserDetails(sessionId, web_user_details);
                            let response_time = new Date().getTime();
				        	setTimeout(function(){
				        		//Event Storing =============================
					            let signup_event = {
					            	type : "signup_response",
					            	time : response_time,
					            	details : resp_obj
					            }
					            helper.logger_api_call(sessionId,tab_id, signup_event, signup_event["type"]);
					            //===========================================
				        	},1);
				        	
				        }
                        res.send(resp_obj);
                    });

                });
            }
            else
            {
                resp_obj.status= false;
                resp_obj.error = "Email is already registered."
                if(sessionId && tab_id)
		        {
                    let response_time = new Date().getTime();
		        	setTimeout(function(){
		        		//Event Storing =============================
			            let signup_event = {
			            	type : "signup_response",
			            	time : response_time,
			            	details : resp_obj
			            }
			            helper.logger_api_call(sessionId,tab_id, signup_event, signup_event["type"]);
			            //===========================================
		        	},1);
		        	
		        }
                res.send(resp_obj);
            }
        });
    }
});
/*
* While user add or remove any favourites this api calls
* @param {obj} req, res
* return {obj}   
*/
app.post('/message/favourites',function (req, res) {
    let body = req.body;
    // console.log("Body is "+JSON.stringify(body,null,2));
    let user_id = body.user_id;
    let product_line = body.product_line;
    let product_id = body.product_id;
    let request_type = body.request_type;

    let sessionId = body["basic_info"]["session_id"];
    let tab_id = body["basic_info"]["tab_id"];
    let query = "";
    if(sessionId && tab_id) {
        let response_time = new Date().getTime();
    	setTimeout(function()
    	{
    		let event = {
	            type : "add_or_remove_favorite",
	            time : response_time,
	            details : {
	                request_type : request_type,
	                product_id : product_id,
	                product_line : product_line,
	                user_id : user_id
	            }
	        };
	        helper.logger_api_call(sessionId,tab_id, event, event["type"]);
    	},1);
    }
    if(request_type=="add") // adding the current product into favourite
    {
        query = "INSERT INTO favorites(user_id,product_line,product_id)VALUES('"+user_id+"','"+product_line+"','"+product_id+"')";
    }
    else // removing the current product as favourite
    {
        query = "DELETE FROM favorites WHERE user_id='"+user_id+"' AND product_line='"+product_line+"' AND " +
            "product_id='"+product_id+"'";
    }
    //insert or delete product_id
    dbQueries(query,"selekt",function (data) {
    });
    res.send({"status":true});
});
/*
* While user makes requests for favourites this api calls
* @param {obj} req, res
* return {obj} favorite_obj  
*/
app.post('/message/getfavourites',function(req,res)
{
    let data = req.body;
    // console.log("================ Favorites API ===================");
    let user_id = data["user_id"];
    let result_type = data["result_type"];
    let basic_info = data["basic_info"];
    let sessionId;
    if(basic_info)
    	sessionId = basic_info["session_id"];
    //=========================================
    // console.log("USER ID : ",user_id);
    let product_list = [];
    let query = "select * from favorites where user_id = '"+user_id+"'";
    // console.log(query);
    dbQueries(query,"selekt",function (result) // getting all user favourite products from the database 
    {
        // console.log("Result length : ",result.length);
        let count=0;
        let favorite_obj = {};
        if(result.length>0)
        {
            for(let i in result)
            {
                let product_line = result[i].product_line;
                let product_id = result[i].product_id;
                if(result_type!="favorites") // user wants the product details
                {
                    /*let products_query = {
                        "index": 'products_data',
                        "type": product_line,
                        "body":
                            {"query":{"term":{"_id":product_id}}}
                    };*/
                    product_line = mapping.product_line_to_db_keys[product_line];
                    let mongo_query = {es_mysql_id:parseInt(product_id)};
                    //helper.get_products_by_query(mongo_query,product_line,function (data) {
                    mongo.runQuery(product_line, mongo_query, function(data, err)
                    {
                        count++;
                        product_list = product_list.concat(data);
                        if(count==result.length)
                        {
                            // console.log("sending favorites");
                            res.send({"product_list":product_list});
                        }
                    })
                }
                else // user wants the product id in product line wise
                {
                    if(!favorite_obj.hasOwnProperty(product_line))
                        favorite_obj[product_line] = [];
                    favorite_obj[product_line].push(product_id);
                }
            }
            if(result_type=="favorites")
            {
            	if(sessionId)
			    {
				    //Event storing ===========================
				    let fav_event = {
				    	type : "favorites_response",
				    	time : new Date().getTime(),
				    	details : {
				    		user_id : user_id,
				    		favorites_list : favorite_obj
				    	}
				    }
				    sessions.createUserDetails(sessionId, fav_event);
				    //========================================
				}
                res.send({"favorites":favorite_obj});
            }
        }
        else
        {
            // console.log("No favorites found");
            if(sessionId)
		    {
			    //Event storing ===========================
			    let fav_event = {
			    	type : "favorites_response",
			    	time : new Date().getTime(),
			    	details : {
			    		user_id : user_id,
			    		favorites_list : favorite_obj
			    	}
			    }
			    sessions.createUserDetails(sessionId, fav_event);
			    //========================================
			}
            res.send({"product_list":[]});
        }
    });
});
/*
* If any new event is happen in website this api calls
* @param {obj} req, res
* return {obj}  
*/
app.post('/message/events',function (req,res) {
    let event = req.body;
    // console.log("--------------- Event Received ----------------");
    // console.log(event);
    // console.log("-----------------------------------------------")
    let deviceId = event["device_id"];
    let sessionId = event["session_id"];
    let tabId = event["tab_id"];
    let user_id = event["user_id"];
    let details = 
    {
    	device_id : deviceId,
    	unique_id : deviceId,
    	session_id : sessionId,
    	user_id : user_id,
    	device : event["device"]
    }
    sessions.createUserDetails(sessionId,details);
    if(sessions.isSessionExists(sessionId, tabId))
    {
        let context = sessions.getContext(sessionId, tabId);
        event["chat_id"] = context.chat_id;
    }
    let user_agent = event["user_agent"];
    let crawlerstatus = false;
    if(user_agent)
    {
    	crawlerstatus = helper.crawlerStatus(user_agent);
	}
    if(!crawlerstatus)
    {
	    helper.logger_api_call(sessionId, tabId, event, event["type"]);
	}
    res.send({"status":true});
});
/*
* If user gives the feed back this api calls
* @param {obj} req, res
* return {obj}  
*/
app.post('/message/feedback',function(req, res){
    let body = req.body;
    let basic_info = body["basic_info"];
    let device_id = basic_info["device_id"]
    let email = body["email"];
    let feedback = body["content"];
    let time = new Date().getTime();
    let feedback_query = "insert into feedback(email,device_id, content, timestamp)values('"+email+"','"+device_id+"','"+feedback+"','"+time+"');";
    dbQueries(feedback_query,"selekt", function(result)
    {
        // console.log("feedback successfully saved");
    });
    res.send({status : true});
});
/*
* If user clicks on any mobile this api calls
* @param {obj} req, res
* return {obj}  
*/
app.post('/message/mobiles',function(req, res){
	// console.log("In Mobiles Api");
	let data = req.body;
    // console.log(data);
    let type = data["type"];
    if(type=="product_details")
    {
        //got only one product id
        let product_id = data["product_id"];
        mobile_url_messages.productDetails(product_id, function(result)
        {
            res.send(result);
        });
    }
    else
    {
        // got message from url
    	let message = data["message"];
    	let from = data["from"];

    	mobile_url_messages.mobileUrlMessages(message, from, function(result)
    	{
    		res.send(result);
    	});
    }
});
let insp_ids =
[
    7, 26, 34, 49, 68, 101, 125, 137,14, 146, 159, 178, 182, 86, 123, 33, 50
];
function get_inspirations(callback) {
    let total_results = [];
    getInspirationResult(insp_ids, 0);
    function getInspirationResult(insp_ids, index){
        get_insp_by_id(insp_ids[index], function (data) {
            index++
            total_results = total_results.concat(data)
            if (index < insp_ids.length) {
                getInspirationResult(insp_ids, index);
            }
            else
            {
                callback(total_results)
            }
        })
    }
}
function get_insp_by_id(id, callback) {
    let query = {
        index: 'styling_rules',
        type: 'inspiration_tiles',
        body: {
            query: {
                match_phrase: {'_id': '' + id}
            }
        }
    }
    elasticSearch.runQuery(query, function (res, total) {
        let jsonResult = {}
        jsonResult['id'] = res[0]['_id']
        jsonResult['heading'] = res[0]['_source']['inspiration_name']
        jsonResult['sub_heading'] = ''

        jsonResult['imageUrl'] = res[0]['_source']['image']
        if (jsonResult['imageUrl'] == undefined) {
            jsonResult['imageUrl'] = 'https://assets.myntassets.com/assets/images/1263585/2016/4/6/11459930369265-bebe-Coral-Orange-Sequinned-Swarovski-Elements-Maxi-Dress-5551459930366199-1.jpg'
        }
        jsonResult['_source'] = res[0]['_source']

        callback(jsonResult)
    })
}
function dbQueries(query,database,callback) {
    connection.query("use "+database);
    connection.query(query,function(error,result)
    {
        if(!error)
        {
            callback(result);
        }
        else
            console.log(error)
    });
}
function get_obj(require_res)
{
    let resp_obj = {data:{}};
    resp_obj.status = true;
    resp_obj.data.user_id = require_res["user_id"];
    resp_obj.data.username = require_res["username"];
    resp_obj.data.email = require_res["email"];
    resp_obj.data.age = require_res["age"];
    resp_obj.data.body_shape = require_res["body_shape"];
    resp_obj.data.body_concerns = require_res["body_concerns"].split(",");
    resp_obj.data.height = require_res["height"];
    resp_obj.data.skin_colour = require_res["skin_colour"];
    resp_obj.error = "";

    return resp_obj;
}