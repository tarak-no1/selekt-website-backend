let global = require('./global.js');
let helper = require('./helper');
let sessions = require('./sessions');
let mapping = require('./mapping');
let functions = require('./functions');
let entity_bot = require("./entity_bot");
let fs = require("fs");
const word_mapping = JSON.parse(fs.readFileSync("./json/word_mapping.json"));
let bot_questions = require("./bot_questions");
let conversationGraph = require("./conversationGraphs");
const given_templates = JSON.parse(fs.readFileSync("./json/templates.json"));

/*
* this function is used to getting the entities and processesing the user typed message
* @param {string} sessionId, tabId
* @param {string} message
* @param {obj} event
*/
function processingMessage(sessionId, tabId, message, event_time, url_message_status)
{
    let user_context = sessions.getContext(sessionId, tabId);
    console.log("getting the entities for message");
    entity_bot.getEntities(message, user_context, function(entities)
    {
        user_context["current_entities"] = entities;
        console.log("Detected Entities ==============");
        console.log(JSON.stringify(entities, null, 2));

        addEntitiesToContext(sessionId, tabId, entities, message);
        user_context = sessions.getContext(sessionId, tabId);
        storeUserTypedMessageEvent(sessionId, tabId, message, entities, event_time, url_message_status);

        let message_delay = user_context["message_delay"];
        if(user_context.hasOwnProperty("product_line_not_included"))
        {
            delete user_context["product_line_not_included"];
            let no_indianwear_message = bot_questions.noIndianWearMessage();
            setTimeout(function(){
                sendMessage("chat", no_indianwear_message, sessionId, tabId);
            },message_delay);
            return;
        }
        else if(user_context.hasOwnProperty("greet"))
        {
            delete user_context["greet"];
            let greet_message = bot_questions.greetMessage();
            setTimeout(function(){
                sendMessage("chat", greet_message, sessionId, tabId);
            },message_delay);
            message_delay+=3000;
            let suggestion_message = bot_questions.sendSuggestionsMessage();
            setTimeout(function(){
                sendMessage("chat", suggestion_message, sessionId, tabId);
            },message_delay);
            message_delay+=3000;
            return;
        }
        else
        {
            processBotUnderStoodModule(sessionId, tabId, entities, message, event_time);
            user_context = sessions.getContext(sessionId, tabId);
            message_delay = user_context["message_delay"];
            if(user_context.hasOwnProperty("bot_understood_conflict"))
            {
                delete user_context["bot_understood_conflict"];
                return;
            }
        }
        message_delay = displayReasonMessages(sessionId, tabId, message_delay);
        setTimeout(function()
        {
            helper.getTotalProducts(sessionId, tabId, function(total_products){
                console.log("Total : ", total_products, "Conflict status: ", user_context["conflict_status"]);
                // checking the user context is having product line or not
                if(!user_context.hasOwnProperty("product_line"))
                {
                    askProductlineQuestion(sessionId, tabId);
                }
                else if(user_context["conflict_status"])
                {
                    user_context["conflict_status"] = false;
                    let conflict_question = bot_questions.occasionConflictQuestion(user_context["product_line"], user_context["occasion_productline_map"][0]["key"]);
                    sendMessage("chat", conflict_question, sessionId, tabId);
                }
                else if(total_products==0)
                {
                    user_context["is_flow_complete"] =true;
                    let no_products_message = bot_questions.noProductFoundMessage();
                    sendMessage("chat", no_products_message, sessionId, tabId);
                }
                else if(total_products<=10)
                {
                    user_context["is_flow_complete"] =true;
                    let less_products_message = bot_questions.lessProducts(total_products);
                    sendMessage("chat", less_products_message, sessionId, tabId);
                }
                else if(!user_context["occasion_status"]) // checking the user is already answered the occasion question or not
                {
                    askOccasionQuestion(sessionId, tabId);
                }
                else if(!user_context["user_profile"]["profile_status"]) // checking the user profile question is answered or not
                {
                    checkUserProfileStatus(sessionId, tabId);
                }
                else if(!user_context["user_profile"]["concern_status"]) // checking the body concern question is answered or not
                {
                    askBodyConcernQuestion(sessionId, tabId);
                }
                else
                {
                    askPreEndQuestion(sessionId, tabId);
                }
            });
        },message_delay);
    });
}
let processingUserAnswer = 
{
    occasionQuestion: function(sessionId, tabId, answers) // user answered value is belongs to occasionQuestion
    {
        let event_time = new Date().getTime();
        let user_context = sessions.getContext(sessionId, tabId);
        user_context["occasion_status"] = true;
        console.log("user selected the occasion question option");
        let user_answer = answers[0];
        storeUserSelectedMessageEvent(sessionId, tabId, user_answer, event_time);
        if(user_answer=="nothing")
        {
            checkUserProfileStatus(sessionId, tabId);
        }
        else
        {
            processingMessage(sessionId, tabId, user_answer);
        }
    },
    broadOccasionQuestion: function(sessionId, tabId, answers) // user answered value is belongs to broadOccasionQuestion
    {
        console.log("user selected the broad occasion question option");
        let user_context = sessions.getContext(sessionId, tabId);
        let user_answer = answers[0]
        let event_time = new Date().getTime();
        storeUserSelectedMessageEvent(sessionId, tabId, user_answer, event_time);
        if(user_answer=="nothing")
        {
            user_context["occasion_status"] = true;
            checkUserProfileStatus(sessionId, tabId);
        }
        else
        {
            processingMessage(sessionId, tabId, user_answer);
        }
    },
    bodyProfileQuestion: function(sessionId, tabId, user_profile) // user answered value is belongs to bodyprofileQuestion
    {
        let message_delay = 0;
        let user_context = sessions.getContext(sessionId, tabId);
        let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
        if(Object.keys(user_profile).length>0)
        {
            // getting the all reason values of selected body profile values
            let tags = helper.getBodyProfileReasons(user_context["product_line"], user_profile);
            for(let vl in tags)
            {
                // getting the all profile benefits
                if(user_context["benefits"].indexOf(tags[vl]["value"])==-1 && user_context["priority_values"]["benefits"].indexOf(tags[vl]["value"])==-1)
                {
                    user_context["benefits"].push(tags[vl]["value"]);
                }
            }
            helper.makeTagReasons(product_line, tags, [], function(with_conflict_reasons, without_conflict_reasons)
            {
                if(without_conflict_reasons.length>0)
                {
                    let profile_reason_message = bot_questions.bodyProfileReasons(without_conflict_reasons);
                    sendMessage("chat", profile_reason_message, sessionId, tabId);
                    message_delay+=3000;
                }
                setTimeout(function(){
                    askBodyConcernQuestion(sessionId, tabId);
                },message_delay);
            });
        }
        else
        {
            askBodyConcernQuestion(sessionId, tabId);
        }
    },
    bodyConcernQuestion: function(sessionId, tabId, body_concerns) // user answered value is belongs to bodyconcernQuestion
    {
        let message_delay = 0;
        let user_context = sessions.getContext(sessionId, tabId);
        let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
        if(body_concerns.length>0)
        {
            // getting the reasons only for body concerns
            let tags = helper.getBodyConcernReasons(user_context["product_line"], body_concerns);
            for(let vl in tags)
            {
                if(user_context["benefits"].indexOf(tags[vl]["value"])==-1 && user_context["priority_values"]["benefits"].indexOf(tags[vl]["value"])==-1)
                {
                    user_context["benefits"].push(tags[vl]["value"]);
                }
            }
            helper.makeTagReasons(product_line, tags, [], function(with_conflict_reasons, without_conflict_reasons)
            {
                if(without_conflict_reasons.length>0)
                {
                    let profile_reason_message = bot_questions.bodyConcernReasons(without_conflict_reasons);
                    sendMessage("chat", profile_reason_message, sessionId, tabId);
                    message_delay +=3000;
                }
                setTimeout(function(){
                    askPreEndQuestion(sessionId, tabId);
                },message_delay);
            });
        }
        else
        {
            askPreEndQuestion(sessionId, tabId);
        }
    },
    preEndQuestion: function(sessionId, tabId, user_answer)
    {
        let user_context = sessions.getContext(sessionId, tabId);
        let event_time = new Date().getTime();
        storeUserSelectedMessageEvent(sessionId, tabId, user_answer[0], event_time);
        if(user_answer[0]=="refine_the_list") // checking the user selected value is refine list or not
        {
            user_context["question_queue"] = ["customize"];
            sessions.storeContext(sessionId, tabId, user_context);
            askRefineListQuestion(sessionId, tabId);
        }
        else if(user_answer[0]=="give_feed_back") // checking the user selected value is feedback or not
        {
            let feedback_question = bot_questions.feedbackQuestion();
            sendMessage("chat", feedback_question, sessionId, tabId);
        }
    },
    refineListQuestion: function(sessionId, tabId, answer_keys)
    {
        let event_time = new Date().getTime();
        let user_context = sessions.getContext(sessionId, tabId);
        let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
        let last_question_asked = user_context.unanswered_question;
        let new_questions_to_add_to_queue = [];
        let user_selected_messages = [];
        let adjective_questions_count_status = true;
        for(let i=0;i<answer_keys.length;i++) 
        {
            let answer_key = answer_keys[i];
            let new_questions_key = last_question_asked + "_" + answer_key;
            let selected_answer = conversationGraph.questions[product_line][last_question_asked]["options"][answer_key]['text'];
            storeUserSelectedMessageEvent(sessionId, tabId, selected_answer, event_time);
            user_selected_messages.push(selected_answer);
            // Adding the benefit/adjective associated with the answer to context

            let adjective_to_be_added = conversationGraph.questions[product_line][last_question_asked]['options'][answer_key]['adjective'];
            let benefit_to_be_added = conversationGraph.questions[product_line][last_question_asked]['options'][answer_key]['benefit'];
            
            if(adjective_to_be_added && adjective_to_be_added != "" && adjective_to_be_added != "na")
            {
                if(user_context["adjectives_new"].indexOf(adjective_to_be_added)==-1 && user_context["priority_values"]["adjectives"].indexOf(adjective_to_be_added)==-1)
                {
                    if(adjective_questions_count_status)
                    {
                        adjective_questions_count_status = false;
                        user_context["adjective_questions_count"]++;
                    }
                    user_context.adjectives_new.push(adjective_to_be_added);
                }
                let adj_name = helper.getBenefitname(adjective_to_be_added, product_line, "adjectives");
                let adj_value = word_mapping[product_line]["adjectives"][adj_name];
                if(adj_value)
                {
                    if(adj_value.reason!="" && adj_value.reason!="na")
                    {
                        user_context["reason_messages"].push({"type":"adjective","display_name":adj_name,"reason":adj_value.reason});
                    }
                }
            }
            if(benefit_to_be_added && benefit_to_be_added != "" && benefit_to_be_added != "na")
            {
                if(user_context["benefits"].indexOf(benefit_to_be_added)==-1)
                {
                    user_context.benefits.push(benefit_to_be_added);
                }
                let ben_name = helper.getBenefitname(benefit_to_be_added, product_line, "benefits");
                let ben_value = word_mapping[product_line]["benefits"][ben_name];
                if(ben_value)
                {
                    if(ben_value.reason!="" && ben_value.reason!="na")
                    {
                        user_context["reason_messages"].push({"type":"benefit","display_name":ben_name,"reason":ben_value.reason});    
                    }
                }
            }
            // Checking if new questions to be added to queue basis the present answer
            if(conversationGraph.conversation_rules[product_line][new_questions_key]) {
                new_questions_to_add_to_queue = new_questions_to_add_to_queue.concat(conversationGraph.conversation_rules[product_line][new_questions_key]);
            }
        }
        user_context["previous_message"] = user_selected_messages.join(", ");
        Array.prototype.unshift.apply(user_context['question_queue'], new_questions_to_add_to_queue);
        sessions.storeContext(sessionId, tabId, user_context);
        helper.getTotalProducts(sessionId, tabId, function(total_products)
        {
            let message_delay = 0;
            if(user_context["reason_messages"].length>0)
            {
                message_delay = displayReasonMessages(sessionId, tabId, message_delay);
            }
            if(total_products<=10)
            {
                let less_products_message = bot_questions.lessProducts(total_products);
                setTimeout(function(){
                    sendMessage("chat", less_products_message, sessionId, tabId);
                },message_delay);
            }
            else
            {
                
                setTimeout(function(){
                    askRefineListQuestion(sessionId, tabId);
                }, message_delay);
            }
        });
    },
    userProfileStatusQuestion: function(sessionId, tabId, answer_keys)
    {
        let event_time = new Date().getTime();
        let user_context = sessions.getContext(sessionId, tabId);
        
        let user_answer = answer_keys[0];
        storeUserSelectedMessageEvent(sessionId, tabId, user_answer, event_time);
        if(user_answer=="its_me") //
        {
            user_context["user_profile"]["profile_status"] = true;
            let user_profile = 
            {
                age : user_context["user_profile"]["age"],
                height : user_context["user_profile"]["height"],
                skintone : user_context["user_profile"]["skintone"],
                bodyshape : user_context["user_profile"]["bodyshape"] 
            };
            this.bodyProfileQuestion(sessionId, tabId, user_profile);
        }
        else if(user_answer=="not_me") // 
        {
            askUserProfileQuestion(sessionId, tabId);
        }
        else //skip condition
        {
            user_context["user_profile"]["profile_status"] = true;
            sessions.storeContext(sessionId, tabId, user_context);
            askBodyConcernQuestion(sessionId, tabId);
        }
    },
    feedbackQuestion: function(sessionId, tabId, feedback)
    {
        let user_context = sessions.getContext(sessionId, tabId);
        let user_feedback_text = feedback[0];
        if(user_feedback_text=="other")
        {
            user_context["unanswered_question"] = "take_feedback";
            let ask_feedback = bot_questions.textMessages("Kindly message me your feedback");
            sendMessage("chat", ask_feedback, sessionId, tabId);
        }
        else
        {
            let feedback_response_message = bot_questions.textMessages("Thanks for your feedback");
            sendMessage("chat",feedback_response_message,sessionId, tabId);
            let event_time = new Date().getTime();
            let user_details = sessions.getUserDetails(sessionId);
            let feedback_query = "insert into feedback(device_id, content, timestamp)values('"+user_details["device_id"]+"','"+user_feedback_text+"','"+event_time+"');";
            helper.saveInSql("selekt", feedback_query);
        }
    },
    occasionProductlineQuestion: function(sessionId, tabId, user_answer)
    {
        let message = user_answer[0];
        let event_time = new Date().getTime();
        storeUserSelectedMessageEvent(sessionId, tabId, message, event_time);
        processingMessage(sessionId, tabId, message);
    },
    someIdentifiedQuestion: function(sessionId, tabId, user_answer)
    {
        let event_time = new Date().getTime();
        let user_context = sessions.getContext(sessionId, tabId);
        let user_selected_message = user_answer[0];
        if(user_selected_message=="no")
        {
            storeUserSelectedMessageEvent(sessionId, tabId, "No", event_time);
            let suggestion_message = bot_questions.textMessages("Which clothing line are you are you looking for? \n(Eg: Dresses, Tops etc)");
            sendMessage("chat", suggestion_message, sessionId, tabId);
        }
        else
        {
            storeUserSelectedMessageEvent(sessionId, tabId, "Yes", event_time);
            processingMessage(sessionId, tabId, user_selected_message);
        }
    },
    occasionConflictQuestion: function(sessionId, tabId, user_answer)
    {
        let event_time = new Date().getTime();
        let user_context = sessions.getContext(sessionId, tabId);
        let user_selected_message = user_answer[0];
        
        if(user_selected_message=="restart_chat")
        {
            user_context = sessions.clearContext(sessionId, tabId);
            sessions.storeContext(sessionId, tabId, user_context);
        
            storeUserSelectedMessageEvent(sessionId, tabId, "Restart Chat", event_time);
            let suggestion_message = bot_questions.sendSuggestionsMessage();
            sendMessage("suggestions", suggestion_message, sessionId);
        }
        else
        {
            delete user_context["product_line"];
            delete user_context["occasion_productline_map"];
            storeUserSelectedMessageEvent(sessionId, tabId, user_selected_message, event_time);
            processingMessage(sessionId, tabId, user_selected_message);
        }
    }
};
/*
* this function is used to send the 
*/
function displayReasonMessages(sessionId, tabId, message_delay)
{
    let user_context = sessions.getContext(sessionId, tabId);
    if(user_context.hasOwnProperty("product_line") && (user_context["reason_messages"].length>0 || (!user_context["occasion_status"] && !user_context["user_profile"]["profile_status"] && !user_context["conflict_status"])))
    {
        setTimeout(function(){
            helper.getReasonMessage(sessionId, tabId, function(reason_msg){
                if(reason_msg!="")
                {
                    let reason_message_info = bot_questions.textMessages(reason_msg);
                    reason_message_info["reason_status"] = true;
                    sendMessage("chat", reason_message_info, sessionId, tabId);
                }
            });
        },message_delay);
        message_delay += 3000;
    }
    return message_delay;
}

function processBotUnderStoodModule(sessionId, tabId, entities, message, event_time)
{
    let user_context = sessions.getContext(sessionId, tabId);
    let message_delay = user_context["message_delay"];
    let templates = getBotUnderstoodTemplate(entities);
    if(event_time && Object.keys(entities).length>0)
    {
        let cleaned_message = entity_bot.processMessageWithEntities(message, entities);
        if(templates.length>0)
        {
            let bot_understood_message = bot_questions.textMessages("I understood: "+templates[0]);
            setTimeout(function()
            {
                //autocomplete_es.updateMessagePopularity(templates[0]);
                sendMessage("chat", bot_understood_message, sessionId, tabId);
            }, message_delay);
            message_delay += 3000;
            if(cleaned_message!="")
            {
                let some_identified_question = bot_questions.someIdentifiedQuestion(message);
                setTimeout(function(){
                    sendMessage("chat", some_identified_question, sessionId, tabId);
                }, message_delay);
                message_delay += 3000;
                user_context["bot_understood_conflict"] = true; 
            }
        }
        else
        {
            let no_entities_message = bot_questions.noEntitiesMessage();
            setTimeout(function()
            {
                sendMessage("chat",no_entities_message,sessionId, tabId);
            },message_delay);
            user_context["bot_understood_conflict"] = true; 
        }
    }
    storeBotUnderStoodEvent(sessionId, tabId, templates, message);
    user_context["message_delay"] = message_delay;
    sessions.storeContext(sessionId, tabId, user_context);
}
/*
* this function is used to ask refine list questions
* @param {string} sessionId, tabId
*/
function askRefineListQuestion(sessionId, tabId)
{
    let message_delay = 1000;
    console.log("In askRefineListQuestion function");
    let user_context = sessions.getContext(sessionId, tabId);
    let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
    if(user_context['question_queue'].length == 0) // checking the conversation flow is completed or not
    {
        user_context["is_flow_complete"] = true;
        let conversation_completed_message = bot_questions.conversationCompleteMessage();
        setTimeout(function(){
            sendMessage("chat",conversation_completed_message,sessionId, tabId);
        },message_delay);               
    }
    else
    {
        user_context["prev_questions_queue"] = user_context["question_queue"].concat();
        user_context["is_flow_complete"] = false;
        let next_question = user_context['question_queue'].shift();
        user_context["unanswered_question"] = next_question;

        let question = conversationGraph.questions[product_line][next_question];
        helper.processConversationQuestion(sessionId, tabId, next_question, question, function(response){
            //console.log(JSON.stringify(response, null, 2));
            sendMessage("chat", response, sessionId, tabId);
        });
    }
}
/*
* this function is used to ask the productline questions
* @param {string} sessionId, tabId
*/
function askProductlineQuestion(sessionId, tabId)
{
    console.log("in askProductlineQuestion function");
    let user_context = sessions.getContext(sessionId, tabId);
    console.log(user_context);
    // checking the user message is only containg the occasion or not
    if(user_context.hasOwnProperty("occasion_productline_map") && !user_context.hasOwnProperty("broad_category"))
    {
        let occasion = user_context["occasion_productline_map"][0]["key"];
        let values = user_context["occasion_productline_map"][0]["values"];
        // asking the particular occasion product lines for the user
        let occasion_msg = bot_questions.occasionProductlineQuestion(occasion, values);
        sendMessage("chat",occasion_msg, sessionId, tabId);
    }
    // checking the user message is having the body profile question or not
    if(user_context.hasOwnProperty("body_profile_productline_map") && !user_context.hasOwnProperty("broad_category"))
    {
        let body_profile_values = user_context["body_profile_productline_map"];
        let common_product_lines = body_profile_values[0]["values"];
    }
    if(user_context["current_entities"] && Object.keys(user_context["current_entities"]).length==0)
    {
        let suggestion_message = bot_questions.sendSuggestionsMessage();
        sendMessage("chat", suggestion_message, sessionId, tabId);
    }
}
/*
* this function is used to check the user context is already have the user profile data or not
* @param {string} sessionId, tabId
*/
function checkUserProfileStatus(sessionId, tabId)
{
    let message_delay = 0;
    let user_context = sessions.getContext(sessionId, tabId);
    let profile_values = ["age", "height", "bodyshape", "skintone"];
    let unanswered_profile_values = profile_values.filter(function(pv){
        return !user_context["user_profile"].hasOwnProperty(pv);
    });
    let profile_info_msg = bot_questions.profileInfoMessage();
    sendMessage("chat", profile_info_msg, sessionId, tabId);
    message_delay += 3000;
    if(unanswered_profile_values.length==0)
    {
        let profile_status_question = bot_questions.userProfileStatusQuestion(user_context["user_profile"]);
        setTimeout(function(){
            sendMessage("chat", profile_status_question, sessionId, tabId);
        },message_delay);
    }
    else
    {
        setTimeout(function(){
            askUserProfileQuestion(sessionId, tabId);
        },message_delay);
    }
}
/*
* this function is used to ask the user profile question
* @param {string} sessionId, tabId
*/
function askUserProfileQuestion(sessionId, tabId)
{
    console.log("In askUserProfileQuestion function");
    let user_context = sessions.getContext(sessionId, tabId);
    let profile_values = ["age", "height", "bodyshape", "skintone"];
    let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
    let profile_question_object = {};
        
    for(let i in profile_values)
    {
        let p_value = profile_values[i];
        if(!user_context.hasOwnProperty(p_value))
        {
            let profile_info = word_mapping[product_line][p_value];
            let p_value_keys = Object.keys(profile_info);
            if(p_value_keys.length>0)
            {
                profile_question_object[p_value] = p_value_keys.map(function(a){
                    let status = false;
                    if(user_context["user_profile"].hasOwnProperty(p_value) && user_context["user_profile"][p_value]==a)
                    {
                        status = true;
                    }
                    return {
                        "value":a,
                        "status":status
                    };
                });
                if(p_value!="height")
                {
                    profile_question_object[p_value] = profile_question_object[p_value].sort(function(v1, v2){
                        a = v1["value"].toLowerCase();
                        b = v2["value"].toLowerCase();
                        if (a < b) return -1;
                        if (a > b) return 1;
                        return 0;
                    });
                }
                else
                {
                    profile_question_object[p_value] = profile_question_object[p_value].reverse();
                }
            }
        }
    }
    if(Object.keys(profile_question_object).length>0)
    {
        let profile_question_message = bot_questions.bodyProfileQuestion(profile_question_object);
        sendMessage("chat", profile_question_message, sessionId, tabId);
    }
    else
    {
        askBodyConcernQuestion(sessionId, tabId);
    }
}
/*
* this function is used to ask the body concerns question
* @param {string} sessionId, tabId
*/
function askBodyConcernQuestion(sessionId, tabId)
{
    console.log("in askBodyConcernQuestion function")
    let user_context = sessions.getContext(sessionId, tabId);
    let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
    let body_concerns_info = word_mapping[product_line]["body_concern"];
    let body_concerns_values = Object.keys(body_concerns_info);
    let body_concerns_array = [];
    if(!user_context.hasOwnProperty("body_concerns"))
    {
        body_concerns_array = body_concerns_values.map(function(a){
            let status = false;
            if(user_context["user_profile"]["body_concerns"].indexOf(a)!=-1)
            {
                status = true;
            }
            return {
                "value":a,
                "status":status
            };
        });
    }
    if(body_concerns_array.length>0 && !user_context["user_profile"]["concern_status"])
    {
        let body_concerns_message = bot_questions.bodyConcernQuestion(body_concerns_array);
        sendMessage("chat",body_concerns_message, sessionId, tabId);
    }
    else
    {
        askPreEndQuestion(sessionId, tabId);
    }
}
/*
* this function is used to ask the pre end question
* @param {string} sessionId, tabId
*/
function askPreEndQuestion(sessionId, tabId)
{
    let message_delay = 0;
    let user_context = sessions.getContext(sessionId, tabId);
    user_context["is_flow_complete"] = true;
    user_context["question_queue"] = user_context["prev_questions_queue"].concat();
    if(user_context["question_queue"].length==0)
    {
        let product_list_reason_message = bot_questions.productListReasonMessage(user_context["user_profile"]);
        sendMessage("chat", product_list_reason_message, sessionId, tabId);
        message_delay += 3000
        let pre_end_question = bot_questions.preEndQuestion();
        setTimeout(function(){
            sendMessage("chat", pre_end_question, sessionId, tabId);
        },message_delay);
    }
    else
    {
        askRefineListQuestion(sessionId, tabId);
    }
}
/*
* this function is used to ask the occasion type questions
* @param {string} sessionId, tabId
*/
function askOccasionQuestion(sessionId, tabId)
{
    let message_delay = 0;
    console.log("in askOccasionQuestion function");
    let user_context = sessions.getContext(sessionId, tabId);
    let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
    // checking the broad occasion is exists in the context or not
    if(user_context.hasOwnProperty("broad_occasion"))
    {
        let broad_occasion_value = user_context["broad_occasion"]["key"];
        let sub_occasions = word_mapping[product_line]["broad_occasions"][broad_occasion_value]["occasion_map"];
        let occasion_question = bot_questions.occasionQuestion(broad_occasion_value, sub_occasions);
        sendMessage("chat", occasion_question, sessionId, tabId);
    }
    else
    {
        let occasion_info_question = bot_questions.occasionInfoMessage();
        sendMessage("chat", occasion_info_question, sessionId, tabId);
        message_delay += 3000;
        let broad_occasions = word_mapping[product_line]["broad_occasions"];
        let broad_occasion_keys = Object.keys(broad_occasions);
        let broad_occasion_question = bot_questions.broadOccasionQuestion(user_context["product_line"], broad_occasion_keys);
        setTimeout(function(){
            sendMessage("chat", broad_occasion_question, sessionId, tabId);
        },message_delay);
    }
}
/*
* this function is used to add the current entities into the context
* @param {string} sessionId, tabId
* @param {obj} entities
*/
function addEntitiesToContext(sessionId, tabId, entities, message)
{
    console.log("In add entities to context function");
    let user_context = sessions.getContext(sessionId, tabId);
    let message_delay = 0;
    if(Object.keys(entities).length==0)
    {
        let no_entities_message = bot_questions.noEntitiesMessage();
        setTimeout(function(){
            sendMessage("chat",no_entities_message,sessionId, tabId);
        },message_delay);
        message_delay +=3000;
        user_context["message_delay"] = message_delay;
        return;
    }
    if(entities.hasOwnProperty("product_line_not_included"))
    {
        user_context["product_line_not_included"] = true;
        return;
    }
    if(entities.hasOwnProperty("product_line"))
    {
        console.log("Found productline in message");
        if(entities['product_line'] != user_context.product_line)
        {
            if(user_context.product_line != undefined)
            {
                user_context = sessions.clearContext(sessionId,tabId);
            }
        }
        user_context["title"] = message;
        user_context["product_line"] = entities['product_line'];
    }
    let product_line = null;
    try{
        product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
    }catch(e){}
    // checking the user message is having broad_occasion or not
    if(entities.hasOwnProperty("broad_occasion"))
    {
        user_context["broad_occasion"] = entities['broad_occasion'];
        user_context["conflict_status"] = false;
        let broad_occasion_benefit = entities["broad_occasion"]["benefit_entity_key"];
        if(user_context["priority_values"]["benefits"].indexOf(broad_occasion_benefit))
        {
            user_context["priority_values"]["benefits"].push(broad_occasion_benefit);   
        }
        user_context["previous_message"] = entities["broad_occasion"]["key"];
        if(product_line)
        {
            let display_name = helper.getBenefitname(broad_occasion_benefit, product_line, "benefits");
            let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
            }
        }
    }
    // checking the user message is having occasion or not
    if(entities.hasOwnProperty("occasion"))
    {
        user_context["occasion"] = entities["occasion"];
        user_context["occasion_status"] = true;
        user_context["conflict_status"] = false;
        let occasion_benefit = entities["occasion"]["benefit_entity_key"];
        if(user_context["priority_values"]["benefits"].indexOf(occasion_benefit))
        {
            user_context["priority_values"]["benefits"].push(occasion_benefit);   
        }
        user_context["previous_message"] = entities["occasion"]["key"];
        if(product_line)
        {
            let display_name = helper.getBenefitname(occasion_benefit, product_line, "benefits");
            let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("occasion_productline_map"))
    {
        user_context["occasion_productline_map"] = entities["occasion_productline_map"];
        if(!user_context.hasOwnProperty("occasion") && !user_context.hasOwnProperty("broad_occasion") && user_context.hasOwnProperty("product_line"))
        {
            user_context["conflict_status"] = true;
        }
        else
        {
            for(let i in user_context["filters"])
            {
                let filter = user_context["filters"][i];
                if(JSON.stringify(filter) == JSON.stringify({"no_occasion":"no_value_detected"}))
                {
                    user_context["filters"].splice(i, 1);
                }
            }
            user_context["conflict_status"] = false;
        }
    }
    let remove_filter_status = false;
    if(entities.hasOwnProperty("type")) // checking the current user message type
    {
        if(entities["type"]=="remove")
        {
            remove_filter_status = true;
        }
        else
        {
            //
        }
    }
    if(entities.hasOwnProperty("attribute_values"))
    {
        let entities_attribute_values = entities["attribute_values"];
        if(remove_filter_status) // checking the remove type existed in the message or not
        {
            // removing the filters from the context
            for(let i in entities_attribute_values)
            {
                let entity_attr_value = entities_attribute_values[i];
                user_context["remove_tags"].push({key:entity_attr_value.db_key, value: entity_attr_value.key});
            }
        }
        else
        {
            // adding the filters to the context
            for(let i in entities_attribute_values)
            {
                let entity_value = entities_attribute_values[i];
                for(let j in user_context["remove_tags"])
                {
                    let rem_tag = user_context["remove_tags"][j];
                    if(entity_value.db_key==rem_tag.key && entity_value.key == rem_tag.value)
                    {
                        user_context["remove_tags"].splice(j, 1);
                        break;
                    }
                }
            }
        }
        for(let i in entities_attribute_values)
        {
            let obj = {};
            obj["product_filter."+entities_attribute_values[i].db_key] = entities_attribute_values[i].key;
            user_context["filters"].push(obj);
        }
    }
    if(entities.hasOwnProperty("range")) // checking the range is in user message or not
    {
        let range = entities.range.type;
        let number = entities.range.numbers;
        let range_query = {"range":{"product_filter.discount_price":{}}};
        
        if(number)
        {
            if(range=="above")
            {
                if(remove_filter_status)
                {
                    context.remove_tags.push({"key":"range","value":{"product_filter.discount_price":{"gte":number[0]}}});
                }
                else {
                    range_query.range["product_filter.discount_price"]["gte"] = number[0];
                }
            }
            else if(range=="under")
            {
                if(remove_filter_status)
                {
                    context.remove_tags.push({"key":"range","value":{"product_filter.discount_price":{"lte":number[0]}}});
                }
                else {
                    range_query.range["product_filter.discount_price"]["lte"] = number[0];
                }
            }
            else if(range=="between")
            {
                if(number[0]>number[1])
                {
                    let temp = number[0];
                    number[0] = number[1];
                    number[1] = temp;
                }
                if(remove_filter_status)
                {
                    context.remove_tags.push({"key":"range","value":{"product_filter.discount_price":{"gte":number[0],"lte":number[1]}}});
                }
                else {
                    range_query.range["product_filter.discount_price"]["gte"] = number[0];
                    range_query.range["product_filter.discount_price"]["lte"] = number[1];
                }
            }
            if(Object.keys(range_query.range["product_filter.discount_price"]).length>0)
                user_context["filters"].push(range_query);
        }
    }
    if(entities.hasOwnProperty("adjectives"))
    {
        let adjectives = entities["adjectives"];
        for(let i in adjectives)
        {
            let adjective = adjectives[i]["entity_key"];
            if(user_context["priority_values"]["adjectives"].indexOf(adjective)==-1)
            {
                user_context["adjective_questions_count"]++;
                user_context["priority_values"]["adjectives"].push(adjective);
            }
            let reason = adjectives[i]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"adjective","display_name":adjectives[i]["key"],"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("entity_benefits"))
    {
        let entity_benefits = entities["entity_benefits"];
        for(let i in entity_benefits)
        {
            let benefit = entity_benefits[i]["entity_key"];
            if(user_context["priority_values"]["benefits"].indexOf(benefit)==-1)
            {
                user_context["priority_values"]["benefits"].push(benefit);
            }
            let reason = entity_benefits[i]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":entity_benefits[i]["key"],"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("age"))
    {
        user_context["age"] = entities["age"];
        let age_benefit = entities["age"]["entity_key"];
        if(user_context["priority_values"]["benefits"].indexOf(age_benefit)==-1)
            user_context["priority_values"]["benefits"].push(age_benefit);
        if(product_line && age_benefit!="" && age_benefit!="na")
        {
            let display_name = helper.getBenefitname(age_benefit, product_line, "benefits");
            let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("height"))
    {
        user_context["height"] = entities["height"];
        let height_benefit = entities["height"]["entity_key"];
        if(user_context["priority_values"]["benefits"].indexOf(height_benefit)==-1)
            user_context["priority_values"]["benefits"].push(height_benefit);
        if(product_line && height_benefit!="" && height_benefit!="na")
        {
            let display_name = helper.getBenefitname(height_benefit, product_line, "benefits");
            let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("skintone"))
    {
        user_context["skintone"] = entities["skintone"];
        let skintone_benefit = entities["skintone"]["entity_key"];
        if(user_context["priority_values"]["benefits"].indexOf(skintone_benefit)==-1)
            user_context["priority_values"]["benefits"].push(skintone_benefit);
        if(product_line && skintone_benefit!="" && skintone_benefit!="na")
        {
            console.log(skintone_benefit)
            let display_name = helper.getBenefitname(skintone_benefit, product_line, "benefits");
            console.log(display_name);
            console.log(word_mapping[product_line]["benefits"][display_name])
            let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("bodyshape"))
    {
        user_context["bodyshape"] = entities["bodyshape"];
        let bodyshape_benefit = entities["bodyshape"]["entity_key"];
        if(user_context["priority_values"]["benefits"].indexOf(bodyshape_benefit)==-1)
            user_context["priority_values"]["benefits"].push(bodyshape_benefit);
        if(product_line && bodyshape_benefit!="" && bodyshape_benefit!="na")
        {
            let display_name = helper.getBenefitname(bodyshape_benefit, product_line, "benefits");
            let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
            if(reason && reason!="na" && reason!="")
            {
                // saving the reason into the context
                user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
            }
        }
    }
    if(entities.hasOwnProperty("body_concerns"))
    {
        let body_concerns = entities["body_concerns"];
        user_context["body_concerns"] = body_concerns.map(function(cn){return cn["key"];});
        for(let i in body_concerns)
        {
            let concern_benefit = body_concerns[i]["benefit_key"];
            if(user_context["priority_values"]["benefits"].indexOf(concern_benefit)==-1)
                user_context["priority_values"]["benefits"].push(concern_benefit);
            if(product_line && concern_benefit!="" && concern_benefit!="na")
            {
                let display_name = helper.getBenefitname(concern_benefit, product_line, "benefits");
                let reason = word_mapping[product_line]["benefits"][display_name]["reason"];
                if(reason && reason!="na" && reason!="")
                {
                    // saving the reason into the context
                    user_context["reason_messages"].push({"type":"benefit","display_name":display_name,"reason":reason});
                }
            }
        }
    }
    if(entities.hasOwnProperty("greet") && Object.keys(entities).length==1)
    {
        user_context.greet = true;
    }
    user_context["message_delay"] = message_delay;
    sessions.storeContext(sessionId, tabId, user_context);
}
/*
* this function is used to store user typed message event
*/
function storeUserTypedMessageEvent(sessionId, tabId, message, entities, event_time, url_message_status)
{
    let user_context = sessions.getContext(sessionId, tabId);
    let user_type = "chat_user";
    if(url_message_status)
        user_type = "web_user";

    if(event_time)
    {
        let user_typed_message_event =
        {
            type : "user_typed_message",
            time : event_time,
            module_status: true,
            details: {
                text: message,
                entities: entities,
                user_type : user_type
            },
            product_line: user_context["product_line"],
            chat_id: user_context["chat_id"]
        };
        setTimeout(function(){
            helper.logger_api_call(sessionId, tabId, user_typed_message_event, user_typed_message_event["type"]);
        },1);
    }
}
/*
* this function is used to store user selected message event
*/
function storeUserSelectedMessageEvent(sessionId, tabId, message, event_time)
{
    let user_context = sessions.getContext(sessionId, tabId);
    if(event_time)
    {
        let user_typed_message_event =
        {
            "type": "user_selected_message",
            "chat_id": user_context["chat_id"],
            "time": event_time,
            "product_line": user_context["product_line"],
            "details": message
        };
        setTimeout(function(){
            helper.logger_api_call(sessionId, tabId, user_typed_message_event, user_typed_message_event["type"]);
        },1);
    }
}
/*
* this function is used to store bot understood message event
*/
function storeBotUnderStoodEvent(sessionId, tabId, templates, user_message)
{
    let user_context = sessions.getContext(sessionId, tabId);

    let event_time = new Date().getTime();
    let event = {
        type : "bot_understood_message",
        time : event_time,
        chat_id : user_context["chat_id"],
        bot_understood_message : templates,
        user_message : user_message
    };
    setTimeout(function(){
        helper.logger_api_call(sessionId, tabId, event);
    },1);
}
function displayBotUnderstoodMessage(sessionId, tabId, entities, message, event_time, message_delay)
{
    if(event_time) // if event_time exists means user typed message came to this function otherwise bot calls this function 
    {
        let cleaned_message = entity_bot.processMessageWithEntities(message, entities);
        let templates = getBotUnderstoodTemplate(entities);
        if(templates.length>0)
        {
            let bot_understood_message = bot_questions.textMessages("I understood: "+templates[0]);
            setTimeout(function()
            {
                sendMessage("chat", bot_understood_message, sessionId, tabId);
            }, message_delay);
            message_delay += 3000;
            if(cleaned_message!="")
            {
                let some_identified_question = bot_questions.someIdentifiedQuestion(message);
                setTimeout(function(){
                    sendMessage("chat", some_identified_question, sessionId, tabId);
                }, message_delay);
                message_delay += 3000;
                return;
            }
        }
        else
        {
            let no_entities_message = bot_questions.noEntitiesMessage();
            setTimeout(function()
            {
                sendMessage("chat",no_entities_message,sessionId, tabId);
            },message_delay);
            return;
        }
    }
    return message_delay;
}
/*
* this function is used to get bot understood template based on entities
*/
function getBotUnderstoodTemplate(entities)
{   
    let msg_entities = JSON.parse(JSON.stringify(entities));
    delete msg_entities["greet"];
    if(msg_entities.hasOwnProperty("occasion_productline_map"))
    {
        delete msg_entities["broad_occasion"];
        delete msg_entities["occasion"];
        for(let i in msg_entities["occasion_productline_map"])
        {
            let obj = msg_entities["occasion_productline_map"][i];
            let type = obj["type"]=="broad_occasions"?"broad_occasion":"occasion";
            msg_entities[type] = obj["key"];
        }
        delete msg_entities["occasion_productline_map"];
    }
    if(msg_entities.hasOwnProperty("range"))
    {
        msg_entities["numbers"] = msg_entities["range"]["numbers"].sort(function(a,b){return a-b;});;
        msg_entities["range"] = msg_entities["range"]["type"];
    }
    if(msg_entities.hasOwnProperty("attribute_values"))
    {
        msg_entities["attribute_values"] = msg_entities["attribute_values"].map(function(a){return a["key"];});
        msg_entities["attribute_values"] = msg_entities["attribute_values"].join(" ");
    }
    if(msg_entities.hasOwnProperty("body_profile_productline_map"))
    {
        delete msg_entities["height"];
        delete msg_entities["age"];
        delete msg_entities["skintone"];
        delete msg_entities["bodyshape"];
        for(let i in msg_entities["body_profile_productline_map"])
        {
            let obj = msg_entities["body_profile_productline_map"][i];
            msg_entities[obj["type"]] = obj["key"];
        }
        delete msg_entities["body_profile_productline_map"];
    }
    if(msg_entities.hasOwnProperty("body_concerns"))
    {
        msg_entities["body_concerns"] = msg_entities["body_concerns"].map(function(a){return a["key"];});
    }
    if(msg_entities.hasOwnProperty("adjectives"))
    {
        msg_entities["adjectives"] = msg_entities["adjectives"].map(function(a){return a["key"];});
    }
    let templates = given_templates.concat();
    let entity_keys = Object.keys(msg_entities);

    templates = templates.filter(function(a){
        let splited_value = a.split("<<");
        return splited_value.length==entity_keys.length+1;
    });
    for(let i in entity_keys)
    {
        let key = entity_keys[i];
        let obj_key = "<<"+key+">>";
        templates = templates.map(function(a){
            if(a.indexOf(obj_key)!=-1)
            {
                a = a.replace(obj_key, msg_entities[key]);
            }
            return a;
        });
    }
    templates =  templates.filter(function(a){
        return a.indexOf(">>")==-1;
    });
    return templates;
}
/*
* this is used to send messages to user based on the sessionId
* @param {string} sessionId, tabId
* @param {string} channel
* @param {obj} data
*/
function sendMessage(channel, data, sessionId, tabId) {
    console.log("sending message to user","\nType : ", data["type"], "sessionID  : ",sessionId,"Tab Id : ",tabId);
    let user_context = sessions.getContext(sessionId, tabId);
    //======================= Event Storing into Log file ==========================
    let event_product_line = user_context["product_line"];
    data["end_of_chat"] = user_context["is_flow_complete"];
    if(channel=="chat" || channel=="")
    {
        data["product_line_status"] = false;
        if(event_product_line)
            data["product_line_status"] = true;
    }
    let event_time = new Date().getTime();
    data["time"] = event_time;
    helper.logger_api_call(sessionId, tabId, data, data["type"]);
    //==============================================================================
    let socket = global.getUserSocket(sessionId, tabId);
    if(socket)
    {
        socket.emit(channel, data);
    }
}
module.exports = 
{
    processingMessage: processingMessage,
    processingUserAnswer: processingUserAnswer,
    getBotUnderstoodTemplate : getBotUnderstoodTemplate
}