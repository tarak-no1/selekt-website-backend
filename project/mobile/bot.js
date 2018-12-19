const fs = require("fs");
const mobile_entities = require('./mobile_entities');
const elasticSearch = require('../db_config/elasticSearch');
const sessions = require('../sessions');
const global = require('../global.js');
const helper = require('./helper');
const mapping = require('./mapping');

const conversation_rules = JSON.parse(fs.readFileSync("./mobile/conversation_rules_mobile.json"));
const question_flow = JSON.parse(fs.readFileSync("./mobile/question_flow_mobile.json"));

const actions = 
{
    findAllPhones : function (sessionId, tabId)
    {
        console.log("In findAllPhones Function");
        let context = sessions.getMobileContext(sessionId, tabId);
        //if question state is true, need to start question flow from the beginning
        if(context['question_state']) {
            context['question_queue'] = conversation_rules['start'].slice(0);
            context["question_state"] = false;
        }
        console.log("Current Question Queue : ",context["question_queue"]);
        if(context["question_queue"].length>0)
        {
            let next_question = context["question_queue"][0];
            // if next question is price type question and user already given the price range question
            // we need to skip the current question
            if(next_question=="price_question" && context.hasOwnProperty("price_range"))
            {
                context["question_queue"].shift();
            }
        }
        // if current question queue not having any value, stop asking questions and give the final response
        if(context["question_queue"].length==0)
        {
            console.log("Conversation completed. sending the mobile list");
            //question flow completed
            let flow_completed = {
                type : "text",
                message : "Your list is ready."
            }
            context["is_flow_complete"] = true;
            //sending mobile list
            sendMobileList(sessionId, tabId, function(product_list, pref_message){
                sendMessage("mobile_list", product_list, sessionId, tabId);
                //console.log(JSON.stringify(response, null,2));
                setTimeout(function(){
                    sendMessage("chat", flow_completed, sessionId, tabId);
                },context["delay"]);
                if(product_list["list"].length>0)
                {
                    //console.log(pref_message);
                    let pref_message_obj = {
                        type : "text",
                        message : "Considering your preferences, we recommend the below phone.\n\n"
                            + pref_message
                    }
                    if(pref_message!="")
                    {
                        let delay = context["delay"]+2000;
                        setTimeout(function(){
                            sendMessage("chat", pref_message_obj, sessionId, tabId);
                        },delay);
                    }
                }
            });
        }
        else
        {
            //saving current question queue
            context["prev_questions_queue"] = context["question_queue"].concat();
            let next_question = context['question_queue'].shift();
            context["unanswered_question"] = next_question;
            console.log("Next Question is :",next_question);

            let question = question_flow[next_question];
            let response = {
                type : question["question_type"],
                text : question["text"],
            };

            // Populating options
            response.options = [];
            let answer_keys = Object.keys(question['options']);
            for(let i in answer_keys) 
            {
                let key = answer_keys[i];
                let answer_text = question['options'][key]['text'];
                let option = {
                    key : key,
                    value : answer_text
                }
                response.options.push(option);
            }
            //sending mobile list
            sendMobileList(sessionId,tabId, function(product_list){
                sendMessage("mobile_list", product_list, sessionId,tabId);
                //console.log(JSON.stringify(response, null,2));
                setTimeout(function(){
                    sendMessage("chat", response, sessionId, tabId);
                },context["delay"]);
            });
        }
    },
    knowledgeQuestion: function (sessionId, tabId)
    {
        console.log("In Knowledge Question Function")
        let context = sessions.getMobileContext(sessionId, tabId);
        let entities = context["current_entities"]
        let knowledge_key_list = ["sim_type","sim_size","network_support","front_camera_features",
            "gps_type","usb_type","display_type","gpu_type","processor_cores","battery_type","audio_formats",
            "screen_protection","sensors","sensor_type","processor_type","attribute","in_the_box"];
        knowledge_key_list = knowledge_key_list.filter(function(key)
        {
            return entities.hasOwnProperty(key);
        });
        //console.log("Knowledge Question keys : ", knowledge_key_list);
        if(knowledge_key_list.length>0)
        {
            let knowledge_message = "";
            for(let i in knowledge_key_list)
            {
                let knowledge_key = knowledge_key_list[i];
                for(let j in entities[knowledge_key])
                {
                    let key = entities[knowledge_key][j]
                    knowledge_message += key.split("_").join(" ").toUpperCase() +":\n\t"+(mapping.haveKnowledge(key)?mapping.getKnowledge(key):"")+"\n";
                }
            }
            let msg = {
                type : "text",
                message : knowledge_message
            };
            setTimeout(function(){
                sendMessage("chat", msg, sessionId, tabId);
            },context["delay"]);
        }
        else
        {
            let err_msg = {
                type:"text",
                message:"Sorry we don't have any information about this."
            };
            setTimeout(function(){
                sendMessage("chat", err_msg, sessionId, tabId);
            },context["delay"]);
        }
    },
    compareMobiles : function(sessionId, tabId){
        console.log("In Compare Mobiles function : ==================");
        let context = sessions.getMobileContext(sessionId, tabId);
        let entities = context["current_entities"];

        let mobile_query = {
            query:
            {
                terms:{
                    model_name : [context["model_name1"],context["model_name2"]]
                }
            }
        };
        console.log("getting mobile list from elasticSearch");
        elasticSearch.getMobilesData(mobile_query, function(response, total, error)
        {
            let compare_data = [];
            if(!error && total>0)
            {
                let att_messages = [];
                for(let i in response)
                {
                    let source = {};
                    let phone_details = response[i]["_source"];
                    if(entities.hasOwnProperty("attribute"))
                    {
                        let msg = "MODEL NAME : "+phone_details["model_name"]+"\n";
                        //console.log(msg);
                        for(let i in entities["attribute"])
                        {
                            let key = entities["attribute"][i];
                            let original_key = mapping.isSKUKeyExists(key) ? mapping.getSKUKey(key) : key.toUpperCase().split("_").join("");
                            let unit_key = mapping.isUnitExists(key)?mapping.getUnitKey(key):"";
                            msg += original_key +": "+phone_details[key]+unit_key+"\n"; 
                            att_messages.push(msg);
                        }
                    }
                    source["id"] = response[i]["_id"];
                    source = Object.assign(source, phone_details);
                    source = helper.cleanSource(source);
                    compare_data.push(source);
                }
                if(att_messages.length>0)
                {
                    let user_msg = 
                    {
                        type : "text",
                        message : att_messages.join("\n")
                    };
                    setTimeout(function(){
                        sendMessage("chat", user_msg, sessionId, tabId);
                    },context["delay"]);
                }
            }
            let compare_obj = 
            {
                type : "compare_mobiles",
                data : compare_data
            };
            sendMessage("mobile_list", compare_obj, sessionId, tabId);
        });
    },
    betterPhoneInTwo : function(sessionId, tabId){
        console.log("In betterPhoneInTwo function");
        let context = sessions.getMobileContext(sessionId, tabId);
        let entities = context["current_entities"];
        let mobile_query = 
        {
            query : {
                terms : {
                    "model_name":[
                        entities["model_name1"],entities["model_name2"]
                    ]
                }
            }
        };
        
        let fields = [], better_status = true;
        if(entities.hasOwnProperty("attribute"))
        {
            better_status = false;
            for(let i in entities["attribute"])
            {
                let attribute = entities["attribute"][i];
                let spec_score = mapping.hasSpecScores(attribute)?mapping.getSpecScores(attribute):undefined;
                if(!spec_score)
                {
                    setTimeout(function(){
                        sendMessage("chat",{type : "text", message : "Sorry! Information not available."});
                    },context["delay"]);
                    return;
                }
                fields.push(spec_score);
            }
        }
        if(entities.hasOwnProperty("features"))
        {
            better_status = false;
            for(let i in entities["features"])
            {
                let feature = entities["features"][i];
                let spec_score = mapping.hasSpecScores(feature)?mapping.getSpecScores(feature):undefined;
                if(!spec_score)
                {
                    setTimeout(function(){
                        sendMessage("chat",{type : "text", message : "Sorry! Information not available."});
                    },context["delay"]);
                    return;
                }
                fields.push(spec_score);
            }
        }
        if(fields.length==0)
        {
            fields = mapping.getFieldsAttribute("better");
        }
        console.log("gettnig mobile list from elasticSearch");
        elasticSearch.getMobilesData(mobile_query, function(response, total, error){
            let compare_data = [];
            if(!error && total>1)
            {
                let scores = {};
                let phone1 = response[0]["_source"];
                let phone2 = response[1]["_source"];
                //
                if(better_status)
                {
                    let output_sku1 = "MODEL NAME : "+phone1["model_name"]+"\n";
                    let output_sku2 = "MODEL NAME : "+phone2["model_name"]+"\n";
                    let output_common="";

                    let sku1_spec_score = 0;
                    let sku2_spec_score = 0;
                    let sku1_feature_score = 0;
                    let sku2_feature_score = 0;
                    for (let i = 0; i < fields.length; i++) {
                        var key = fields[i];
                        if (key == "overall_score")
                        {
                            if (phone1["overall_score"] > phone2["overall_score"])
                                sku1_spec_score += 1;
                            else
                                sku2_spec_score += 1;
                        }
                        else if(key!="model_name")
                        {
                            let original_key = mapping.isSKUKeyExists(key) ? mapping.getSKUKey(key) : undefined;
                            let unit_key = mapping.getUnitKey(key);
                            let value=0;
                            // if true first one is better
                            if(key != 'price') {
                                if (phone1[key] < phone2[key]) value = 2;
                                if (phone1[key] > phone2[key]) value = 1;
                            } else {
                                if (phone1[key] < phone2[key]) value = 1;
                                if (phone1[key] > phone2[key]) value = 2;
                            }
                            if (value == 1) {
                                //sku1 is added with +
                                sku1_feature_score += 1;
                                output_sku1 += " + " + original_key + ": " + phone1[key] + " " + unit_key +"\n";
                                output_sku2 += " - " + original_key + ": " + phone2[key] + " " + unit_key +"\n";
                            } else if (value == 2) {
                                sku2_feature_score += 1;
                                output_sku1 += " - " + original_key + ": " + phone1[key] + " " + unit_key +"\n";
                                output_sku2 += " + " + original_key + ": " + phone2[key] + " " + unit_key +"\n";
                            } else {
                                output_sku1 += " . " + original_key + ": " + phone1[key] + " " + unit_key +"\n";
                                output_sku2 += " . " + original_key + ": " + phone2[key] + " " + unit_key +"\n";
                            }
                        }
                    }
                    if (sku1_feature_score > sku2_feature_score || (sku1_feature_score == sku2_feature_score && sku1_spec_score > sku2_spec_score))
                        output_common = phone1["model_name"] + " is better than " + phone2["model_name"];
                    else output_common = phone2["model_name"] + " is better than " + phone1["model_name"];
                    let better_msg = {type:"text",message:output_common};

                    setTimeout(function(){
                        sendMessage("chat",better_msg,sessionId, tabId);
                    },context["delay"]);
                    let phone1_details = {type:"text",message:output_sku1};
                    setTimeout(function(){
                        sendMessage("chat",phone1_details,sessionId, tabId);
                    },context["delay"]+1000);
                         

                    let phone2_details = {type:"text",message:output_sku2};
                    setTimeout(function(){
                        sendMessage("chat",phone2_details,sessionId, tabId);
                    },context["delay"]);
                }
                else
                {
                    let value1=0,value2=0;
                    let mapping_keys = [],output_common="";
                    //console.log(fields);
                    for(let i in fields)
                    {
                        let spec_key = fields[i];
                        mapping_keys.push(mapping.isSKUKeyExists(spec_key)?mapping.getSKUKey(spec_key):spec_key);
                        value1 += parseFloat(phone1[spec_key]);
                        value2 += parseFloat(phone2[spec_key]);
                    }
                    //console.log(value1, value2);
                    if (value1 > value2)
                    {
                        output_common = phone1["model_name"] + " is better than " + phone2["model_name"] + " in " + mapping_keys.join(",");
                    }
                    else if (value1 < value2)
                    {
                        output_common = phone2["model_name"] + " is better than " + phone1["model_name"] + " in " + mapping_keys.join(",");
                    }
                    else
                    {
                        output_common = phone2["model_name"] + " is equal to " + phone1["model_name"] + " in " + mapping_keys.join(",");
                    }
                    //console.log(output_common);
                    let better_msg = {type:"text",message:output_common};
                    setTimeout(function(){
                        sendMessage("chat",better_msg,sessionId, tabId);
                    },context["delay"]);
                }

                // making compare data format
                let data1 = {
                    id : response[0]["_id"]
                };
                data1 = Object.assign(data1, phone1);
                data1 = helper.cleanSource(data1);
                compare_data.push(data1);

                let data2 = {
                    id : response[1]["_id"]
                };
                data2 = Object.assign(data2, phone2);
                data2 = helper.cleanSource(data2);
                compare_data.push(data2);
            }
            let compare_obj =
            {
                type : "compare_mobiles",
                data : compare_data
            };
            sendMessage("mobile_list", compare_obj, sessionId,tabId);
        });
    },
    betterThanSKU: function(sessionId, tabId){
        console.log("In betterThanSKU function");
    },
    betterThanPhone: function(sessionId, tabId){
        console.log("In betterThanPhone function");
    },
    similarPhones : function(sessionId, tabId){
        console.log("In similarPhones function");
    },
    singlePhoneDetails : function(sessionId, tabId){
        console.log("\nIn Single Phone Details Function =========================");
        let context = sessions.getMobileContext(sessionId, tabId);
        let model_name = context["model_name"];
        let single_mobile_query = {
            "query":{"match_phrase":{"model_name":model_name}}
        };
        console.log("getting mobile list from elasticSearch");
        elasticSearch.getMobilesData(single_mobile_query, function(response, total, error){
            console.log("Result Length : ",total)
            if(!error && total>0)
            { 
                let source = response[0]["_source"];
                let field_attributes = mapping.getFieldsAttribute("model_name");
                if(field_attributes.length>0)
                {
                    let msg_values = field_attributes.map(function(attribute){
                        try{
                            return (mapping.isSKUKeyExists(attribute)?mapping.getSKUKey(attribute):attribute) +" : "+ source[attribute] +" "+ (mapping.isUnitExists(attribute)?mapping.getUnitKey(attribute):"");
                        }catch(e){}
                    });
                    let msg = {
                        type : "text",
                        message : msg_values.join("\n")
                    };
                    setTimeout(function(){
                        sendMessage("chat", msg, sessionId, tabId);
                    },context["delay"]);
                }
                let data = {};
                data["id"] = response[0]["_id"];
                data = Object.assign(data, source);
                data = helper.cleanSource(data);
                let single_mobile_obj = {
                    type : "single_phone_details",
                    data : data
                };
                setTimeout(function(){
                    sendMessage("mobile_list", single_mobile_obj, sessionId, tabId);
                },context["delay"]);
            }
        });
    },
    getAttributeValueSKU : function(sessionId, tabId)
    {
        console.log("In getAttributeValueSKU function");
        let context = sessions.getMobileContext(sessionId, tabId);
        let attribute = context["attribute"];
        let sku = context["model_name"];
        let single_mobile_query = {
            "query":{"match_phrase":{"model_name":sku}}
        };
        console.log("getting phonelist from elasticSearch");
        elasticSearch.getMobilesData(single_mobile_query, function(response, total, error){
            console.log("Result Length : ",total)
            if(!error && total>0)
            { 
                let phone_details = response[0]["_source"];
                let message = phone_details["model_name"].toUpperCase()+"\n";
                for(let i in attribute)
                {
                    let att_value = attribute[i];
                    let key = mapping.isDbKeyExists(att_value)?mapping.getDbKey(att_value):att_value;
                    message += (mapping.isSKUKeyExists(key)?mapping.getSKUKey(key):att_value.toUpperCase())+ " : " + phone_details[key] + (mapping.isUnitExists(key)?mapping.getUnitKey(key):"") +"\n";
                }
                let msg = 
                {
                    type : "text",
                    message : message
                };
                setTimeout(function(){
                    sendMessage("chat", msg, sessionId, tabId);
                },context["delay"]);
                let source = {};
                source["id"] = response[0]["_id"];
                source = Object.assign(source, phone_details);
                source = helper.cleanSource(source);
                let single_mobile_obj = {
                    type : "single_phone_details",
                    data : source
                };
                sendMessage("mobile_list", single_mobile_obj, sessionId, tabId);
            }
        });
    },
    specsOfSKU : function(sessionId, tabId)
    {
        console.log("In specsOfSKU function");
    },
    greet : function(sessionId, tabId)
    {
        console.log("In greet function");
    },
    destroyEverything : function(sessionId,tabId)
    {
        console.log("in destroyEverything function");
        let context = sessions.clearMobileContext(sessionId,tabId);
        sessions.storeMobileContext(sessionId, tabId, context);
        let msg = {
            type : "text",
            message : "Your previous data cleared."
        };
        setTimeout(function(){
            sendMessage("chat", msg, sessionId, tabId);
        },context["delay"]);
    }
};
function messageProcessing(sessionId, tabId, message, message_type)
{
    let context = sessions.getMobileContext(sessionId, tabId);
    context["title"] = message;
    context["user_type"] = message_type;
    if(message_type=="website")
        context["delay"] = 2000;
    console.log("Getting Entities for << "+message+">>");
    mobile_entities.getEntities(message, function(entities)
    {
        if(message_type!="range")
            context["question_queue"] = context["prev_questions_queue"].concat();
        if(entities.hasOwnProperty("mobile"))
        {
            context["mobile"] = entities["mobile"];
        }
        if(entities.hasOwnProperty("price_range") && entities.hasOwnProperty("numbers"))
        {
            if(!entities.hasOwnProperty("mobile") && context.hasOwnProperty("mobile") && context["prev_function"]=="findAllPhones")
            {
                entities["mobile"] = context["mobile"]
            }
            context["price_range"] = entities["price_range"][0];
            let numbers = entities["numbers"].sort(function(a,b){return a-b;});
            let start_price = numbers[0];
            context["start_price"] = start_price;
            try{
                let end_price = numbers[1];
                if(end_price)
                    context["end_price"] = end_price;
            }catch(e){}
        }
        if(entities.hasOwnProperty("attribute"))
        {
            context["attribute"] = entities["attribute"];
        }
        if(entities.hasOwnProperty("query"))
        {
            context["query"] = entities["query"];
        }
        if(entities.hasOwnProperty("front_camera_features"))
        {
            context["front_camera_features"] = entities["front_camera_features"];
        }
        if(entities.hasOwnProperty("gps_type"))
        {
            context["gps_type"] = entities["gps_type"];
        }

        if(entities.hasOwnProperty("model_name"))
        {
            if(entities["model_name"].length==1)
                context["model_name"] = entities["model_name"][0];
            else
            {
                entities["model_name1"] = entities["model_name"][0];
                entities["model_name2"] = entities["model_name"][1];
                context["model_name1"] = entities["model_name1"];
                context["model_name2"] = entities["model_name2"];
            }
        }
        if(entities.hasOwnProperty("compare") && entities.hasOwnProperty("numbers"))
        {
            context["compare"] = entities["compare"];
            if(entities["numbers"].length==2 && Object.keys(context["items_list"]).length>=2)
            {
                entities["model_name1"] = context["items_list"][entities["numbers"][0]];
                entities["model_name2"] = context["items_list"][entities["numbers"][1]];
                context["model_name1"] = entities["model_name1"];
                context["model_name2"] = entities["model_name2"];
            }
        }

        if(entities.hasOwnProperty("better"))
        {
            if(entities.hasOwnProperty("numbers"))
            {
                if(entities["numbers"].length==1)
                {
                    entities["model_name"] = context["items_list"][entities["numbers"][0]];
                    context["model_name"] = entities["model_name"];
                }
                else
                {
                    entities["model_name1"] = context["items_list"][entities["numbers"][0]];
                    entities["model_name2"] = context["items_list"][entities["numbers"][1]];

                    context["model_name1"] = entities["model_name1"];
                    context["model_name2"] = entities["model_name2"];
                }
            }
        }
        sessions.storeMobileContext(sessionId,tabId, context);
        
        console.log("Entities : \n",JSON.stringify(entities,null,2));
        
        let bot_function = helper.getFunctionName(entities);
        console.log("\nFunction name : ----------------------------");
        console.log(bot_function);
        console.log("--------------------------------------------");

        if(bot_function)
        {
            context["prev_function"] = bot_function;
            context["current_entities"] = entities;
            actions[bot_function](sessionId, tabId);
        }
        else if(Object.keys(entities).length==0)
        {
            let err_msg = {
                type : "text",
                message : "I'm unable to understand your needs."
            }
            sendMessage("chat", err_msg, sessionId, tabId);
        }
        else
        {
            let err_msg = {
                type : "text",
                message : "This is functionality not yet implemented."
            }
            sendMessage("chat", err_msg, sessionId, tabId);
        }
    });
}
function sendMobileList(sessionId, tabId, callback)
{
    let context = sessions.getMobileContext(sessionId, tabId);
    let mobilelist_query = helper.buildMobileQuery(sessionId, tabId);
    //console.log(JSON.stringify(mobilelist_query, null, 2));
    elasticSearch.getMobilesData(mobilelist_query, function(response, total, error)
    {
        let product_list = {
            type : "suggestions",
            total : total,
            result_type : context["result_type"],
            page_no : context["from"]
        };
        context["result_type"] = "products";
        let pref_message = "";
        if(!error && total>0)
        {
            console.log("Total Mobiles found : ", total);
            let list = response.concat();
            let relavant_attributes = [];
            let reason_message = "";
            if(context.hasOwnProperty("answered_questions"))
            {
                let answered_questions = context["answered_questions"];
                if(Object.keys(answered_questions).length>0)
                {
                    let sort_list = helper.sortListBasedOnPercentile(list, sessionId, tabId);
                    list = sort_list["phone_list"];
                    relavant_attributes = relavant_attributes.concat(sort_list["relavant_attributes"]);
                    reason_message += sort_list["reason_message"];
                }
            }
            if(context.hasOwnProperty("feature_list"))
            {
                let sort_list = helper.sortPhoneListByFeature(list, sessionId, tabId);
                console.log("after sorting");
                list = sort_list["phone_list"];
                relavant_attributes = relavant_attributes.concat(sort_list["relavant_attributes"]);
                reason_message += sort_list["reason_message"];
                let pref_message_list = sort_list["pref_message_list"];
                if(list.length>0)
                {
                    let unique_list =[];
                    for(let i in pref_message_list)
                    {
                        if(unique_list.indexOf(pref_message_list[i])==-1)
                            unique_list.push(pref_message_list[i]);
                    }
                    unique_list = unique_list.map(function(val){
                        let text = val;
                        if(mapping.isSKUKeyExists(val))
                        {
                            text = mapping.getSKUKey(val);
                        }
                        return {"text" : text, "value" : val};
                    });
                    for(let i in unique_list)
                    {
                        let value = unique_list[i]["value"];
                        pref_message += unique_list[i].text +" : "+list[0]["_source"][value]+" "+(mapping.isUnitExists(value)?mapping.getUnitKey(value):"")+"\n";
                    }
                }
            }
            if(reason_message!="")
            {
                let reason_obj = {
                    type : "text",
                    message : reason_message
                };
                sendMessage("chat", reason_obj, sessionId, tabId);
            }
            for(let i=0;i<list.length;i++)
            {
                context["items_list"][i+1] = list[i]["_source"]["model_name"];
            }
            list = helper.getList(list, relavant_attributes);
            let list_start = context["from"]*30;
            product_list["list"] = list.splice(list_start, (list.length-list_start)>30?30:(list.length-list_start));
            console.log("Currently sending mobilelist length : ", product_list["list"].length);
            //console.log(JSON.stringify(list[0],null,2));
        }
        callback(product_list, pref_message);
    });
}
function sendMessage(channel, data, sessionId, tabId) {
    console.log("Message to user : ", data.type);
    let context = sessions.getMobileContext(sessionId, tabId);
    data["end_of_chat"] = context["is_flow_complete"];
    if(channel=="mobile_list")
    {
        data["title"] = helper.capitalizeFirstLetter(context["title"]);
    }
    let socket = global.getUserSocket(sessionId, tabId);
    if(socket){
        if(channel!="mobile_list" || context["user_type"]!="website")
            socket.emit(channel, data);
    }
}
module.exports = {
    messageProcessing : messageProcessing,
    actions : actions,
    sendMobileList : sendMobileList
};