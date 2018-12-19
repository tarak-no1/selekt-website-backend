'use strict';
const sessions = {};
const user_details = {};
const mobile_category_sessions = {};
/*
* this will helps to saving user data that will useful in events saving in logs.
* @param {string} sessionId
* @param {obj} obj
*/
function createUserDetails(sessionId,obj)
{
    user_details[sessionId] = obj;
}
/*
* this will helps to getting user details.
* @param {string} sessionId
* return {obj}
*/
function getUserDetails(sessionId)
{
    if(user_details[sessionId])
        return user_details[sessionId];
    else
        return {};
}
/*
* this will helps to clear the current user context and making the new conversation.
* @param {string} sessionId, tab_id
* return {obj} context
*/
const clearContext = function(sessionId,tab_id)
{
    let present_context = getContext(sessionId,tab_id);
    let user_profile = present_context["user_profile"];
    user_profile["profile_status"] = false;
    user_profile["concern_status"] = false;
    let context = 
    {
        user_profile : user_profile,
        answers : [],
        benefits : [],
        attribute_values : [],
        benefit_tag : {},
        filters : [],
        remove_tags:[],
        from:0,
        priority_values : {benefits:[],adjectives:[]},
        is_flow_complete:false,
        adjectives_new : [],
        adjective_attributes : {},
        prev_questions : [],
        question_queue : [],
        prev_questions_queue : [],
        reason_messages : [],
        delay : 3000,
        favorites : {},
        chat_id : present_context["chat_id"] + 1,
        question_state : true,
        unanswered_question : undefined,
        occasion_status :false,
        conflict_status : false,
        adjective_questions_count : 0,
        title: ""
    };
    return context;
};
/*
* this will helps to get the current user context
* @param {string} sessionId, tab_id
* return {obj} context
*/
const getContext = function(sessionId,tab_id){
    return sessions[sessionId][tab_id].context;
};
/*
* this will helps to store the current user context
* @param {string} sessionId, tab_id
* @param {obj} context
*/
const storeContext = function(sessionId,tab_id,context){
    sessions[sessionId][tab_id]["context"] = context;
};

/*
* this will helps to create the new user context
* @param {string} sessionId, tab_id
* @param {string} deviceId, landing_page
* @param {bool} session_status
*/
const CreateSession = function(sessionId, deviceId, session_status,landing_page, tab_id)
{
    console.log("session created");
    if(!sessions.hasOwnProperty(sessionId))
    {
        sessions[sessionId] = {
            sessionId: sessionId,
            deviceId : deviceId,
            landing_page : landing_page
        };
    }
    sessions[sessionId][tab_id] = 
    {
        session_status : true, //if session_status is true then adjective module otherwise benefit module
        context :
        {
            user_profile : {profile_status:false, concern_status :false, body_concerns:[]}, // containing the user profile info
            answers : [], // containing the user selected answers in benefit module
            benefits : [], // containing the user selected benefits
            attribute_values : [], // containing the fitler values
            benefit_tag : {},
            filters : [], // containing the filter values
            remove_tags:[], // containing the user removed values
            from:0,
            is_flow_complete:false,
            reason_messages : [], // containing the reason messages
            delay : 4000,
            adjectives_new : [], // containing the user selected adjectives
            adjective_attributes : {},
            priority_values : {benefits:[],adjectives:[]}, // containing the high priority values
            prev_questions : [],
            question_queue : [],
            prev_questions_queue : [],
            favorites : {},
            chat_id : 1,
            question_state : true,
            unanswered_question : undefined,
            occasion_status :false,
            adjective_questions_count: 0,
            conflict_status : false, 
            title:""
        }
    }
};
/*
* this will helps to get the particular details of a session based on the type value
* @param {string} sessionId, tab_id
* @param type type
* return {string}
*/
const getSessionDetails = function(sessionId,type,tab_id)
{
    try{
        if(sessions[sessionId][type])
            return sessions[sessionId][type];
        else
            return "";
    }catch(e){
        console.log(sessions[sessionId],tab_id);
        console.log(e);
        return "";}
};

/*
* this will helps to get the current conversation module type
* @param {string} sessionId, tab_id
* return {bool}
*/
const getSessionState = function(sessionId,tab_id)
{
    return sessions[sessionId][tab_id].session_status;
};
/*
* this will helps to check the already existed user or not
* @param {string} checkSessionId, tab_id
* return {bool}
*/
const isSessionExists = function(checkSessionId, tab_id)
{

    if(sessions.hasOwnProperty(checkSessionId))
    {
        if(sessions[checkSessionId].hasOwnProperty(tab_id))
            return true;
    }
    return false
};
/*
* this will helps to delete the previous day users context from the current session list
*/
const deleteUsers = function()
{
    let time = new Date().getTime();
    let session_keys = Object.keys(sessions);
    for(let i in session_keys)
    {
        let session = session_keys[i];
        let difference = time - session;
        if(difference>86400000)
        {
            delete sessions[session];
            delete user_details[session];
        }
    }
}

//****************** mobile section ******************
function createMobileSession(deviceId, sessionId, tabId)
{
    if(!mobile_category_sessions.hasOwnProperty(sessionId))
    {
        mobile_category_sessions[sessionId] = {
            sessionId: sessionId,
            deviceId : deviceId,
        }
    }
    mobile_category_sessions[sessionId][tabId] = {
        context : 
        {
            question_state : true,
            attribute_values : {},
            prev_questions : [],
            question_queue : [],
            prev_questions_queue : [],
            unanswered_question : undefined,
            from : 0,
            chat_id : 1,
            is_flow_complete : false,
            items_list : {},
            prev_function : null,
            result_type : "products",
            delay : 4000
        }
    }
}
function getMobileContext(sessionId, tabId)
{
    return mobile_category_sessions[sessionId][tabId]["context"];
}
function clearMobileContext(sessionId, tabId)
{
    let prev_context = mobile_category_sessions[sessionId][tabId]["context"];
    let new_context = {
        question_state : true,
        attribute_values : {},
        prev_questions : [],
        question_queue : [],
        prev_questions_queue : [],
        unanswered_question : undefined,
        from : 0,
        chat_id : prev_context["chat_id"]+1,
        is_flow_complete : false,
        items_list : {},
        prev_function : null,
        result_type : "products",
        delay : 2000
    };
    return new_context;
    console.log("Mobile Context Cleared")
}
function storeMobileContext(sessionId, tabId, context)
{
    mobile_category_sessions[sessionId][tabId]["context"] = context;
}
function isMobileSessionExist(sessionId, tabId)
{
    if(mobile_category_sessions.hasOwnProperty(sessionId))
    {
        if(mobile_category_sessions[sessionId].hasOwnProperty(tabId))
            return true;
    }
    return false;
}
module.exports = 
{
    getContext : getContext,
    storeContext : storeContext,
    CreateSession:CreateSession,
    isSessionExists:isSessionExists,
    clearContext:clearContext,
    getSessionDetails : getSessionDetails,
    getSessionState : getSessionState,
    createUserDetails : createUserDetails,
    getUserDetails : getUserDetails,

    // mobile section
    createMobileSession : createMobileSession,
    getMobileContext : getMobileContext,
    clearMobileContext : clearMobileContext,
    isMobileSessionExist : isMobileSessionExist,
    storeMobileContext : storeMobileContext
};