let mysql = require('mysql');
let fs = require('fs');

let dateNow = new Date();
let dd = dateNow.getDate();
if(dd<10)
  dd = "0"+dd;
let monthSingleDigit = dateNow.getMonth() + 1,
    mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
let yy = dateNow.getFullYear();
let filename = yy+"-"+mm+"-"+dd+"-results_website.log";
console.log("**************** "+filename+" *************");
let db_config = {
    host : 'localhost',
    user : 'root',
    password : 'selekt.in',
    database : 'tarak'
};
let connection;
function handleDisconnect() {
  connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.
  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server letiable configures this)
    }
  });
}
handleDisconnect();

let event_checker = {};
let myLines = fs.readFileSync("../log_files/"+filename).toString().match(/^.+$/gm);
function Lines(myLines, i)
{
  prev_file_data = i+1;
  console.log(prev_file_data, myLines.length)
  let sentence = myLines[i];
  if(sentence)
  {
    let json_obj = JSON.parse(sentence);
    //console.log(JSON.stringify(json_obj,null,2));
    let event = json_obj["event"];
    if(json_obj.hasOwnProperty("web_details"))
    {
      //web events
      let user_details = json_obj["web_details"];
      let device_id = user_details["device_id"];
      let unique_id = user_details["unique_id"];
      let session_id = user_details["session_id"];
      let tab_id = user_details["tab_id"];
      let user_id = user_details["user_id"];

      //checking user session is already exist or not
      let checking_query = "SELECT * FROM sessions WHERE unique_id='"+unique_id+"' AND session_id='"+session_id+"';";
      sqlQuery(checking_query,function(user_status_result)
      {
        console.log("Event Type is ",event.type);
        if(event.type=="user_landed_in_page")
        {
          let event_time = event.time;
          if(user_status_result.length==0)
          {
            // creating session for user
            let insert_query = "INSERT INTO sessions(session_id, device_id, unique_id, user_id, device_type,  timestamp)"
            +"VALUES('"+session_id+"','"+device_id+"','"+unique_id+"','"+user_id+"','"+event["device"]+"','"+event_time+"');";
            sqlQuery(insert_query, function(insert_result)
            {
              let get_insert_id_query = "SELECT * FROM sessions WHERE unique_id='"+unique_id+"' AND session_id='"+session_id+"';";
              sqlQuery(get_insert_id_query, function(insert_id_result)
              {
                let session_identifier = insert_id_result[0]["id"];
                // inserting user details into the table
                let insert_user_details_query = "INSERT INTO users_details(session_identifier, landing_page_url, browser, os, ip_address)"+
                "VALUES('"+session_identifier+"','"+event["url"]+"','"+event["browser"]+"','"+event["os"]+"','"+event["ip_address"]+"');";
                sqlQuery(insert_user_details_query, function(user_details_result)
                {
                  let insert_tabs_query = "INSERT INTO tabs(session_identifier, tab_id, timestamp)VALUES('"+session_identifier+"','"+tab_id+"', '"+event_time+"');";
                  sqlQuery(insert_tabs_query, function(insert_tabs_result)
                  {
                    //inserting the event into user flow
                    let select_tab_query = "SELECT * FROM tabs WHERE session_identifier='"+session_identifier+"' AND tab_id='"+tab_id+"';";
                    sqlQuery(select_tab_query, function(select_tab_result)
                    {
                      let tab_identifier = select_tab_result[0]["id"];
                      let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','user connected','"+event_time+"');"
                      sqlQuery(user_flow_query, function(user_flow_res){
                        let page_visits_query = "INSERT INTO page_visits(tab_identifier, url, referrer, timestamp)VALUES('"+tab_identifier+"','"+event.url+"','"+event.referrer+"','"+event_time+"');";
                        sqlQuery(page_visits_query,function(page_visits_results)
                        {
                          let url = event.url;
                          if(url.indexOf("/find/")==-1 && url.indexOf("/women")!=-1)
                          {
                            let user_flow_query2 = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','on_product_page','"+event_time+"');";
                            sqlQuery(user_flow_query2, function(user_flow_res)
                            {
                              i++;
                              if(i<myLines.length)
                                Lines(myLines, i);
                            });
                          }
                          else
                          {
                            i++;
                            if(i<myLines.length)
                              Lines(myLines, i);
                          }
                        });
                      });
                    });
                  });
                });
              });
            });
          }
          else
          {
            // user is already existed
            let session_identifier = user_status_result[0]["id"];
            let select_tab_query = "SELECT * FROM tabs WHERE session_identifier='"+session_identifier+"' AND tab_id='"+tab_id+"';";
            sqlQuery(select_tab_query, function(select_tab_result)
            {
              if(select_tab_result.length>0)
              {
                let tab_identifier = select_tab_result[0]["id"];
                let page_visits_query = "INSERT INTO page_visits(tab_identifier, url, referrer, timestamp)VALUES('"+tab_identifier+"','"+event.url+"','"+event.referrer+"','"+event_time+"');";
                sqlQuery(page_visits_query,function(page_visits_results)
                {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                });
              }
              else
              {
                let insert_tabs_query = "INSERT INTO tabs(session_identifier, tab_id, timestamp)VALUES('"+session_identifier+"','"+tab_id+"','"+event_time+"');";
                sqlQuery(insert_tabs_query, function(insert_tabs_result)
                {
                  //inserting the event into user flow
                  let select_tab_query = "SELECT * FROM tabs WHERE session_identifier='"+session_identifier+"' AND tab_id='"+tab_id+"';";
                  sqlQuery(select_tab_query, function(select_tab_result)
                  {
                    let tab_identifier = select_tab_result[0]["id"];
                    let page_visits_query = "INSERT INTO page_visits(tab_identifier, url, referrer, timestamp)VALUES('"+tab_identifier+"','"+event.url+"','"+event.referrer+"','"+event_time+"');";
                    sqlQuery(page_visits_query,function(page_visits_results)
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    });
                  });
                });
              }
            });
          }
        }
        else if(user_status_result.length>0)
        {
          let session_identifier = user_status_result[0]["id"];
          let prev_userId = user_status_result[0]["user_id"];
          if(user_id && prev_userId != user_id)
          {
            let update_userid_query = "UPDATE sessions SET user_id='"+user_id+"' WHERE id='"+session_identifier+"';";
            sqlQuery(update_userid_query, function(res){});            
          }

          let select_tab_query = "SELECT * FROM tabs WHERE session_identifier='"+session_identifier+"' AND tab_id='"+tab_id+"';";
          sqlQuery(select_tab_query, function(select_tab_result)
          {
            let tab_identifier = select_tab_result[0]["id"];
            if(event.type=="user_typed_message")
            {
              let chat_id = event.chat_id;
              let event_time = event.time;
              let module_status = event.module_status;
              let module_type = "benefit_module";
              if(module_status)
                module_type = "adjective_module";

              let event_details = event.details;
              let user_type = event_details.user_type;
              let product_line = event_details["entities"]["product_line"];
              
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length==0)
                {
                  let insert_chat_query = "INSERT INTO chats(tab_identifier, chat_id, start_time, end_time, product_line, module_type, user_type)VALUES('"+tab_identifier+"','"+chat_id+"','"+event_time+"','"+event_time+"','"+product_line+"','"+module_type+"','"+user_type+"');"
                  sqlQuery(insert_chat_query, function(insert_result)
                  {
                    let select_chat_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
                    sqlQuery(select_chat_query, function(select_chat_result)
                    {
                      let chat_identifier = select_chat_result[0]["id"];
                      let insert_message_query = "INSERT INTO messages(chat_identifier,type,sender,text,timestamp)VALUES('"+chat_identifier+"','user_typed_message','"+session_id+"','"+JSON.stringify(event_details)+"','"+event_time+"');";
                      sqlQuery(insert_message_query, function(insert_message_result)
                      {
                        i++;
                        if(i< myLines.length)
                          Lines(myLines, i);
                      });
                    });
                  });
                }
                else
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let productline_query = "";
                  if(product_line)
                  {
                    let existing_product_line = chats_query_result[0]["product_line"];
                    if(product_line!=existing_product_line)
                      productline_query = ", product_line='"+product_line+"'";
                  }
                  let update_chats_query = "UPDATE chats SET end_time = '"+event_time+"'"+productline_query+" WHERE id='"+chat_identifier+"';";
                  sqlQuery(update_chats_query, function(update_chats_result)
                  {
                    let select_message_query = "SELECT count(*) as count from messages where chat_identifier='"+chat_identifier+"' and type='user_typed_message' and sender='"+session_id+"' and text='"+JSON.stringify(event_details)+"' and timestamp='"+event_time+"';";
                    sqlQuery(select_message_query, function(message_status_result)
                    {
                      let message_count = message_status_result[0]["count"];
                      if(message_count==0)
                      {
                        let insert_message_query = "INSERT INTO messages(chat_identifier,type,sender,text,timestamp)VALUES('"+chat_identifier+"','user_typed_message','"+session_id+"','"+JSON.stringify(event_details)+"','"+event_time+"');";
                        sqlQuery(insert_message_query, function(insert_message_result)
                        {
                          i++;
                          if(i< myLines.length)
                            Lines(myLines, i);
                        });
                      }
                      else
                      {
                        i++;
                        if(i< myLines.length)
                          Lines(myLines, i);
                      }
                    });
                  });
                }
              });
            }
            else if(event.type=="user_selected_message")
            {
              let chat_id = event.chat_id;
              let event_details = event.details;
              let event_time = event.time;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let update_chats_query = "UPDATE chats SET end_time = '"+event_time+"' WHERE id='"+chat_identifier+"';";
                  sqlQuery(update_chats_query, function(update_chats_result)
                  {
                    let select_message_query = "SELECT count(*) as count from messages where chat_identifier='"+chat_identifier+"' and type='"+event.type+"' and sender='"+session_id+"' and text='"+JSON.stringify(event_details)+"' and timestamp='"+event_time+"';";
                    sqlQuery(select_message_query, function(message_status_result)
                    {
                      let message_count = message_status_result[0]["count"];
                      if(message_count==0)
                      {
                        let insert_message_query = "INSERT INTO messages(chat_identifier,type,sender,text,timestamp)VALUES('"+chat_identifier+"','"+event.type+"','"+session_id+"','"+JSON.stringify(event_details)+"','"+event_time+"');";
                        sqlQuery(insert_message_query, function(insert_message_result)
                        {
                            i++;
                            if(i< myLines.length)
                              Lines(myLines, i);
                        });
                      }
                      else 
                      {
                        i++;
                        if(i< myLines.length)
                          Lines(myLines, i);
                      }
                    });
                  });
                }
              });
            }
            else if(event.type=="getproducts_response")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let details = event.details;
              let end_of_chat = details.show_message;

              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let select_message_query = "SELECT count(*) as count from messages where chat_identifier='"+chat_identifier+"' and type='product_list' and sender='bot' and timestamp='"+event_time+"';";
                  sqlQuery(select_message_query, function(message_status_result)
                  {
                    let message_count = message_status_result[0]["count"];
                    if(message_count==0)
                    {
                      let insert_message_query = "INSERT INTO messages(chat_identifier, sender, type, text, end_of_chat, timestamp)VALUES('"+chat_identifier+"','bot','product_list','"+JSON.stringify(details).split('"').join("").split("'").join("")+"','"+end_of_chat+"','"+event_time+"');";
                      sqlQuery(insert_message_query, function(insert_message_result)
                      {
                        i++;
                        if(i<myLines.length)
                          Lines(myLines, i);
                      });
                    }
                    else
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    }
                  });
                }
              });
            }
            else if(event.type=="getbenefits_response")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let details = event.details;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let select_message_query = "SELECT count(*) as count from messages where chat_identifier='"+chat_identifier+"' and type='benefit_list' and sender='bot' and timestamp='"+event_time+"';";
                  sqlQuery(select_message_query, function(message_status_result)
                  {
                    let message_count = message_status_result[0]["count"];
                    if(message_count==0)
                    {
                      let insert_message_query = "INSERT INTO messages(chat_identifier, sender, type, text, end_of_chat, timestamp)VALUES('"+chat_identifier+"','bot','benefit_list','"+JSON.stringify(details).split('"').join("").split("'").join("")+"','','"+event_time+"');";
                      sqlQuery(insert_message_query, function(insert_message_result)
                      {
                        i++;
                        if(i<myLines.length)
                          Lines(myLines, i);
                      });
                    }
                    else
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    }
                  });
                }
              });
            }
            else if(event.type=="filters_response")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let details = event.details;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let select_message_query = "SELECT count(*) as count from messages where chat_identifier='"+chat_identifier+"' and type='benefit_list' and sender='bot' and timestamp='"+event_time+"';";
                  sqlQuery(select_message_query, function(message_status_result)
                  {
                    let message_count = message_status_result[0]["count"];
                    if(message_count==0)
                    {
                      let insert_message_query = "INSERT INTO messages(chat_identifier, sender, type, text, end_of_chat, timestamp)VALUES('"+chat_identifier+"','bot','filter_list','"+JSON.stringify(details).split('"').join("").split("'").join("")+"','','"+event_time+"');";
                      sqlQuery(insert_message_query, function(insert_message_result)
                      {
                        i++;
                        if(i<myLines.length)
                          Lines(myLines, i);
                      });
                    }
                    else
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    }
                  });
                }
              });
            }
            else if(event.type=="clicked_on_attribute")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
            
                  let filters_query = "INSERT INTO filters(chat_identifier, attribute, value, event_type, timestamp)VALUES('"+chat_identifier+"','"+event["require_value"]+"','','"+event.type+"','"+event_time+"')";
                  sqlQuery(filters_query, function(filters_result)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  });
                }
              });
            }
            else if(event.type=="benefits_applied")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let removed_benefits = event.details["removed_benefits"];
              let added_benefits = event.details["added_benefits"];
              let total_benefits = [];
              for(let ben in removed_benefits)
              {
                let obj = removed_benefits[ben];
                obj["action_type"] = "removed"
                total_benefits.push(obj);
              }
              for(let ben in added_benefits)
              {
                let obj = added_benefits[ben];
                obj["action_type"] = "added";
                total_benefits.push(obj);
              }

              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let ben_count = 0;
                  if(total_benefits.length==0)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  }
                  else
                  {
                    for(let obj in total_benefits)
                    {
                      let benefit = total_benefits[obj];
                      let benefits_query = "INSERT INTO benefits(chat_identifier, action_type, value, type_of_value, event_name, timestamp)VALUES('"+chat_identifier+"','"+benefit["action_type"]+"','"+benefit["value"]+"','"+benefit["type"]+"','"+event.type+"','"+event_time+"');"
                      sqlQuery(benefits_query, function(benefit_result)
                      {
                        ben_count++;
                        if(ben_count==total_benefits.length)
                        {
                          i++;
                          if(i<myLines.length)
                            Lines(myLines, i);
                        }
                      });
                    }
                  }
                }
              });
            }
            else if(event.type=="clicked_on_remove_benefit")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let benefit_query = "INSERT INTO benefits(chat_identifier, action_type, value, event_name, type_of_value, timestamp)VALUES('"+chat_identifier+"','removed','"+event["details"]["value"]+"','"+event.type+"','"+event["details"]["type"]+"','"+event_time+"');"
                  sqlQuery(benefit_query, function(benefit_result)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  });
                }
              });
            }
            else if(event.type=="filters_applied")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let filters_values = event.details;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  
                  if(filters_values.length==0)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  }
                  else
                  {
                    let result_count = 0;
                    for(let filter in filters_values)
                    {
                      let attribute = filters_values[filter]["key"];
                      let attribute_values = filters_values[filter]["values"];
                      updateFilters(attribute, attribute_values, chat_identifier, event_time, function()
                      {
                        result_count++;
                        if(result_count==filters_values.length)
                        {
                          i++;
                          if(i<myLines.length)
                            Lines(myLines, i);
                        }
                      });
                    }
                  }
                }
              });
            }
            else if(event.type=="clicked_on_undo")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
              sqlQuery(user_flow_query, function(user_flow_result)
              {
                let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
                sqlQuery(chats_query, function(chats_query_result)
                {
                  if(chats_query_result.length>0)
                  {
                    let chat_identifier = chats_query_result[0]["id"];
                    let undo_query = "INSERT INTO undo_list(chat_identifier, timestamp)VALUES('"+chat_identifier+"','"+event_time+"');";
                    sqlQuery(undo_query, function(undo_result)
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    });
                  }
                });
              });
            }
            else if(event.type=="clicked_on_reset")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
                  sqlQuery(user_flow_query, function(user_flow_result)
                  {
                    let reset_list_query = "INSERT INTO reset_list(chat_identifier, timestamp)VALUES('"+chat_identifier+"','"+event_time+"');";
                    sqlQuery(reset_list_query, function(reset_list_result)
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    });
                  });
                }
              });
            }
            else if(event.type=="clicked_on_product")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let product_id = event.product_id;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let product_page_query = "INSERT INTO product_page_visits(chat_identifier, product_id, timestamp)VALUES('"+chat_identifier+"','"+product_id+"','"+event_time+"')";
                  sqlQuery(product_page_query,function(product_page_results)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  });
                }
              });
            }
            else if(event.type=="scrolldown_on_productpage")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+session_identifier+"','"+event.type+"','"+event_time+"');";
              sqlQuery(user_flow_query, function(user_flow_result)
              {
                let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
                sqlQuery(chats_query, function(chats_query_result)
                {
                  if(chats_query_result.length>0)
                  {
                    let chat_identifier = chats_query_result[0]["id"];
                    let insert_scroll_list_query = "INSERT INTO scroll_list(chat_identifier, timestamp)VALUES('"+chat_identifier+"','"+event_time+"');";
                    sqlQuery(insert_scroll_list_query, function(scroll_list_res)
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    });
                  }
                  else
                  {
                    let insert_scroll_list_query = "INSERT INTO inspirations(tab_identifier, event_name, timestamp)VALUES('"+tab_identifier+"','scrolldown','"+event_time+"');";
                    sqlQuery(insert_scroll_list_query, function(result)
                    {
                      i++;
                      if(i<myLines.length)
                      Lines(myLines, i);
                    });
                  }
                });
              });
            }
            else if(event.type=="bot_response")
            {
              let event_time = event.time;
              let event_details = event.details;
              let response_type = event_details["text"];
              let chat_id = event.chat_id;
              if(!response_type)
                response_type = event_details["type"];
              console.log("Response type is :",response_type);
              console.log("Event details" , event_details);
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  if(response_type=="text")
                  {
                    // text type response from bot
                    let message = event_details["message"];
                    let insert_message_query = "INSERT INTO messages(chat_identifier,type,sender,text, end_of_chat, timestamp)VALUES('"+chat_identifier+"','text','bot','"+message+"','"+event_details["end_of_chat"]+"','"+event_time+"');";
                    sqlQuery(insert_message_query, function(insert_message_result)
                    {
                      if(event_details["end_of_chat"]==true)
                      {
                        let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','chat_completed','"+event_time+"');";
                        sqlQuery(user_flow_query, function()
                        {
                          i++;
                          if(i< myLines.length)
                            Lines(myLines, i);
                        });
                      }
                      else{
                        i++;
                        if(i< myLines.length)
                          Lines(myLines, i);
                      }
                    });
                  }
                  else if(event_details["type"]=="single_select" || event_details["type"]=="multi_select")
                  {
                    let selected_type = event_details["type"];
                    let insert_message_query = "INSERT INTO messages(chat_identifier, type, sender, text, end_of_chat, timestamp)VALUES('"+chat_identifier+"','"+selected_type+"','bot','"+JSON.stringify(event_details).split('"').join("").split("'").join("")+"','"+event_details["end_of_chat"]+"','"+event_time+"');";
                    sqlQuery(insert_message_query, function(insert_message_result)
                    {
                      if(event_details["end_of_chat"]==true)
                      {
                        let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','chat_completed','"+event_time+"');";
                        sqlQuery(user_flow_query, function()
                        {
                          i++;
                          if(i< myLines.length)
                            Lines(myLines, i);
                        });
                      }
                      else
                      {
                        i++;
                        if(i< myLines.length)
                          Lines(myLines, i);
                      }
                    });
                  }
                }
                else
                {
                  if(response_type=="text")
                  {
                    let extra_messages_query = "INSERT INTO extra_messages(tab_identifier, content, type, timestamp)VALUES('"+tab_identifier+"','"+event_details.message+"','"+response_type+"','"+event_time+"');"
                    sqlQuery(extra_messages_query, function(extra_messages_result)
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    });
                  }
                  else if(response_type=="related_searches")
                  {
                    let filter_list = event_details["filter_list"];
                    let related_searches = event_details["related_searches"];
                    let filter_list_query = "INSERT INTO extra_messages(tab_identifier, type, content, timestamp)VALUES('"+tab_identifier+"','filter_list','"+filter_list+"','"+event_time+"');";
                    let related_searches_query = "INSERT INTO extra_messages(tab_identifier, type, content, timestamp)VALUES('"+tab_identifier+"','related_searches','"+related_searches+"','"+event_time+"');";

                    sqlQuery(filter_list_query, function(filter_list_response)
                    {
                      sqlQuery(related_searches_query, function(related_searches_result)
                      {
                        i++;
                        if(i<myLines.length)
                          Lines(myLines, i);
                      });
                    });
                  }
                  else if(response_type=="products")
                  {
                    let product_list = event_details["product_list"];
                    let benefits_message = event_details["benefits_message"];
                    let product_list_query = "INSERT INTO extra_messages(tab_identifier, type, content, timestamp)VALUES('"+tab_identifier+"','product_list','"+product_list+"','"+event_time+"');";
                    let benefits_message_query = "INSERT INTO extra_messages(tab_identifier, type, content, timestamp)VALUES('"+tab_identifier+"','benefits_message','"+benefits_message+"','"+event_time+"');";
                    sqlQuery(product_list_query, function(product_list_result)
                    {
                      sqlQuery(benefits_message, function(benefits_message_result)
                      {
                        i++;
                        if(i<myLines.length)
                          Lines(myLines, i);
                      });
                    });
                  }
                }
              });
            }
            else if(event.type=="clicked_on_category")
            {
              let event_time = event.time;
              let category_name = event.name;
              let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"')"
              sqlQuery(user_flow_query, function(user_flow_res)
              {
                let category_query = "INSERT INTO category(tab_identifier, category_name, timestamp)VALUES('"+tab_identifier+"','"+category_name+"','"+event_time+"');";
                sqlQuery(category_query, function(category_result)
                {
                  i++;
                  if(i<myLines.length)
                    Lines(myLines, i);
                });
              });
            }
            else if(event.type=="clicked_benefit_type")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;

              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
                  sqlQuery(user_flow_query, function(user_flow_result)
                  {
                    let benefit_query = "INSERT INTO benefits(chat_identifier, action_type, value, event_name, type_of_value, timestamp)VALUES('"+chat_identifier+"','clicked','"+event.name+"','"+event.type+"','','"+event_time+"');";
                    sqlQuery(benefit_query, function(benefit_query_result)
                    {
                      i++;
                      if(i<myLines.length)
                        Lines(myLines, i);
                    });
                  });
                }
              });
            }
            else if(event.type=="clicked_on_inspirations")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let inspiration_query = "INSERT INTO inspirations(tab_identifier, content, event_name, timestamp)VALUES('"+tab_identifier+"','"+event["inspration_id"]+"','"+event.type+"','"+event_time+"');";
              sqlQuery(inspiration_query, function(inspirations_results)
              {
                let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
                sqlQuery(user_flow_query, function(user_flow_result)
                {
                  i++;
                  if(i<myLines.length)
                    Lines(myLines, i);
                });
              });
            }
            else if(event.type=="welcome_message")
            {
              let event_time = event.time;
              let extra_messages_query = "INSERT INTO extra_messages(tab_identifier,content,timestamp)VALUES('"+tab_identifier+"','"+JSON.stringify(event.details).split('"').join("").split("'").join("")+"','"+event_time+"');";
              sqlQuery(extra_messages_query, function(extra_messages_result)
              {
                i++;
                if(i<myLines.length)
                  Lines(myLines, i);
              });
            }
            else if(event.type=="preference_question")
            {
              let chat_id = event.chat_id;
              let event_time = event.time;
              let question = event.question;
              let answer = event.answer;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let insert_pref_question_query = "INSERT INTO pref_questions(chat_identifier, question, answer, timestamp)VALUES('"+chat_identifier+"','"+question+"','"+answer+"','"+event_time+"');";
                  sqlQuery(insert_pref_question_query, function(insert_pref_question_result)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  });
                }
              });
            }
            else if(event.type=="clicked_on_showmore")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let showmore_query = "INSERT INTO showmore(chat_identifier, timestamp)VALUES('"+chat_identifier+"','"+event_time+"');";
                  sqlQuery(showmore_query, function(showmore_result)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  });
                }
              });
            }
            else if(event.type=="on_product_page")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              let chats_query = "SELECT * FROM chats WHERE tab_identifier='"+tab_identifier+"' AND chat_id='"+chat_id+"';";
              sqlQuery(chats_query, function(chats_query_result)
              {
                if(chats_query_result.length>0)
                {
                  let chat_identifier = chats_query_result[0]["id"];
                  let insert_refresh_list_query = "INSERT INTO refresh_products(chat_identifier, timestamp)VALUES('"+chat_identifier+"','"+event_time+"');";
                  sqlQuery(insert_refresh_list_query, function(refresh_products_result)
                  {
                    i++;
                    if(i<myLines.length)
                      Lines(myLines, i);
                  });
                }
              });
            }
            else if(event.type=="clicked_on_loginbutton" ||event.type=="clicked_on_signupbutton" || event.type=="clicked_on_buybutton" || event.type=="clicked_on_view_profilebutton" || event.type=="user profile updated" || event.type=="user body concerns updated" || event.type=="clicked_on_chat" || event.type=="filter_button_clicked" || event.type=="benefit_button_clicked" || event.type=="clicked_on_about_message")
            {
              let event_time = event.time;
              let chat_id = event.chat_id;
              
              let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
              sqlQuery(user_flow_query, function(user_flow_result)
              {
                i++;
                if(i<myLines.length)
                  Lines(myLines, i);
              });
            }
            else if(event.type=="login_response")
            {
              let event_time = event.time;
              let login_type = event.login_type;
              let event_details = event.details;
              let status = event_details.status;
              let content;
              if(status)
                content = JSON.stringify(event_details["data"]);
              else
                content = event["error"];
              let login_response_query = "INSERT INTO login_details(session_identifier, login_type, details, status, timestamp)VALUES('"+session_identifier+"','"+login_type+"','"+content+"','"+status+"','"+event_time+"');";
              sqlQuery(login_response_query, function(login_query_result)
              {
                let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
                sqlQuery(user_flow_query, function(user_flow_result)
                {
                  i++;
                  if(i<myLines.length)
                    Lines(myLines, i);
                });
              });
            }
            else if(event.type=="signup_response")
            {
              let event_time = event.time;
              let event_details = event.details;
              let status = event_details.status;
              let content = "";
              if(status)
              {
                content = JSON.stringify(event_details["data"]);
              }
              else
              {
                content = event.error;
              }
              let signup_response_query = "INSERT INTO login_details(session_identifier, login_type, details, status, timestamp)VALUES('"+session_identifier+"','signup','"+content+"','"+status+"','"+event_time+"');";
              sqlQuery(signup_response_query, function(sign_query_result)
              {
                let user_flow_query = "INSERT INTO user_flow(tab_identifier, event, timestamp)VALUES('"+tab_identifier+"','"+event.type+"','"+event_time+"');";
                sqlQuery(user_flow_query, function(user_flow_result)
                {
                  i++;
                  if(i<myLines.length)
                    Lines(myLines, i);
                });
              });
            }
            else
            {
              console.log(event.type);
            }
          });
        }
        else
        {
          console.log("\nUser not Found");
          console.log("============================================================================\n\n\n\n");
          i++;
          if(i<myLines.length)
            Lines(myLines, i);
        }
      });
    }
    else
    {
      i++;
      if(i<myLines.length)
        Lines(myLines, i)
    }
  }
  else
  {
    i++;
    console.log("File length : ",myLines.length)
    if(myLines.length>i)
      Lines(myLines,i)
  }
}
function sqlQuery(query,callback)
{
  // console.log(query);
  connection.query(query,function(err,result)
  {
      if(!err)
        callback(result);
      else
      {
        console.log(err)
      }
  });
}

function updateFilters(attribute, values, chat_identifier, event_time, callback)
{
  function attributeValue(values, i)
  {
    let attribute_value = values[i];
    let insert_filters_query = "INSERT INTO filters(chat_identifier, attribute, value, event_type, timestamp)VALUES('"+chat_identifier+"','"+attribute+"','"+attribute_value+"','filters_applied','"+event_time+"');";
    sqlQuery(insert_filters_query, function(res)
    {
      i++;
      if(i<values.length)
        attributeValue(values, i);
      else
        callback();
    });
  }
  if(values.length>0)
    attributeValue(values, 0);
  else
    callback();
}
if(myLines.length>0)
Lines(myLines, 0);
setTimeout(runProgram,60000*2);
let total_minutes = 0;
function runProgram()
{
    total_minutes++;
    let dateNow = new Date();
    let new_dd = dateNow.getDate();
    if(new_dd<10)
      new_dd = "0"+new_dd;
    let monthSingleDigit = dateNow.getMonth() + 1,
        mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
    let yy = dateNow.getFullYear();
    //checking previous date is equal to current date or not...
    if(dd!=new_dd)
    {
      prev_file_data = 0;
      filename = yy+"-"+mm+"-"+new_dd+"-results_website.log";
      dd = new_dd;
    }
    
    // console.log(total_minutes,"**************** "+filename+" *************");
    // if current filename exist then it will run otherwise it will postpone to 1 minute
    try{
      let current_file_data = fs.readFileSync("../log_files/"+filename).toString().match(/^.+$/gm);
      //checking previous data length is equal to current file data length
      if(prev_file_data < current_file_data.length)
      {
        console.log("Starting Index : ",prev_file_data);
        Lines(current_file_data, prev_file_data);
      }
    }catch(e){}
    setTimeout(runProgram,60000);
}