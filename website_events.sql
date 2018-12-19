-- MySQL dump 10.13  Distrib 5.5.54, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: events
-- ------------------------------------------------------
-- Server version	5.5.54-0ubuntu0.14.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `autocomplete`
--

DROP TABLE IF EXISTS `autocomplete`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `autocomplete` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `event_name` varchar(45) NOT NULL,
  `context` longtext NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `autocomplete_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3274 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `benefits`
--

DROP TABLE IF EXISTS `benefits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `benefits` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `action_type` varchar(45) NOT NULL,
  `type_of_value` varchar(45) NOT NULL,
  `value` varchar(45) NOT NULL,
  `event_name` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `benefits_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2005 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category`
--

DROP TABLE IF EXISTS `category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `category` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `category_name` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `category_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1640 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chat_page_visits`
--

DROP TABLE IF EXISTS `chat_page_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_page_visits` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `event_name` varchar(45) NOT NULL,
  `referrer` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `chat_page_visits_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12959 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chats`
--

DROP TABLE IF EXISTS `chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chats` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(11) NOT NULL,
  `chat_id` varchar(45) NOT NULL,
  `start_time` varchar(45) NOT NULL,
  `end_time` varchar(45) NOT NULL,
  `user_type` varchar(45) NOT NULL,
  `module_type` varchar(45) NOT NULL,
  `product_line` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `chats_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27643 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `extra_messages`
--

DROP TABLE IF EXISTS `extra_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `extra_messages` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `content` longtext NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  `type` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `extra_messages_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42861 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `filters`
--

DROP TABLE IF EXISTS `filters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `filters` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `attribute` varchar(45) NOT NULL,
  `value` varchar(45) NOT NULL,
  `event_type` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  `action_type` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `filters_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6977 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inspirations`
--

DROP TABLE IF EXISTS `inspirations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inspirations` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `event_name` varchar(45) NOT NULL,
  `content` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `inspirations_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7139 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `login_details`
--

DROP TABLE IF EXISTS `login_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_details` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `session_identifier` int(45) NOT NULL,
  `login_type` varchar(45) NOT NULL,
  `details` longtext NOT NULL,
  `status` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `session_identifier` (`session_identifier`),
  CONSTRAINT `login_details_ibfk_1` FOREIGN KEY (`session_identifier`) REFERENCES `sessions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `messages` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `sender` varchar(45) NOT NULL,
  `type` varchar(45) NOT NULL,
  `end_of_chat` varchar(45) NOT NULL,
  `text` longtext NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=246621 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `organic_user_questions`
--

DROP TABLE IF EXISTS `organic_user_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `organic_user_questions` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `event_type` varchar(45) NOT NULL,
  `content` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `organic_user_questions_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3530 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `page_visits`
--

DROP TABLE IF EXISTS `page_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `page_visits` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `url` varchar(255) NOT NULL,
  `source` varchar(45) NOT NULL,
  `referrer` varchar(255) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `page_visits_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=59645 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pref_questions`
--

DROP TABLE IF EXISTS `pref_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pref_questions` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `question` varchar(100) NOT NULL,
  `answer` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `pref_questions_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1939 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_page_visits`
--

DROP TABLE IF EXISTS `product_page_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_page_visits` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `product_id` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `product_page_visits_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1059 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_products`
--

DROP TABLE IF EXISTS `refresh_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_products` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `refresh_products_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12855 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reset_list`
--

DROP TABLE IF EXISTS `reset_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reset_list` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `reset_list_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=462 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scroll_list`
--

DROP TABLE IF EXISTS `scroll_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `scroll_list` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `scroll_list_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=29883 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `device_id` varchar(45) NOT NULL,
  `session_id` varchar(45) NOT NULL,
  `unique_id` varchar(45) NOT NULL,
  `user_id` varchar(45) NOT NULL,
  `device_type` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20123 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `showmore`
--

DROP TABLE IF EXISTS `showmore`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `showmore` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `showmore_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=229 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sort_list`
--

DROP TABLE IF EXISTS `sort_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sort_list` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `event_name` varchar(45) NOT NULL,
  `action` varchar(45) NOT NULL,
  `sort_type` varchar(45) NOT NULL,
  `priority_value` text NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `sort_list_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tabs`
--

DROP TABLE IF EXISTS `tabs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tabs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_identifier` int(45) NOT NULL,
  `tab_id` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `session_identifier` (`session_identifier`),
  CONSTRAINT `tabs_ibfk_1` FOREIGN KEY (`session_identifier`) REFERENCES `sessions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26512 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `undo_list`
--

DROP TABLE IF EXISTS `undo_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `undo_list` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `chat_identifier` int(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chat_identifier` (`chat_identifier`),
  CONSTRAINT `undo_list_ibfk_1` FOREIGN KEY (`chat_identifier`) REFERENCES `chats` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_flow`
--

DROP TABLE IF EXISTS `user_flow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_flow` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `event` varchar(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=70249 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_details`
--

DROP TABLE IF EXISTS `users_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users_details` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `session_identifier` int(45) NOT NULL,
  `landing_page_url` varchar(100) NOT NULL,
  `browser` varchar(45) NOT NULL,
  `os` varchar(45) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `session_identifier` (`session_identifier`),
  CONSTRAINT `users_details_ibfk_1` FOREIGN KEY (`session_identifier`) REFERENCES `sessions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18953 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `welcome_message`
--

DROP TABLE IF EXISTS `welcome_message`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `welcome_message` (
  `id` int(45) NOT NULL AUTO_INCREMENT,
  `tab_identifier` int(45) NOT NULL,
  `timestamp` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `tab_identifier` (`tab_identifier`),
  CONSTRAINT `welcome_message_ibfk_1` FOREIGN KEY (`tab_identifier`) REFERENCES `tabs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2017-10-03 15:38:00
