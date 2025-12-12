-- MySQL dump 10.13  Distrib 9.5.0, for Win64 (x86_64)
--
-- Host: localhost    Database: readforyou
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;


--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `requestId` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `dateTime` datetime NOT NULL,
  `bookName` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `pageRange` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES (9,'5f3fede4-38ae-4399-bd7b-7de32dc5522a','/api/analyzeResults/dad2eef1-776e-4fdb-99aa-645f824627e6','2025-12-08 13:43:30','REL1 U1.pdf','1-1','Completed'),(10,'5f3fede4-38ae-4399-bd7b-7de32dc5522a','/api/analyzeResults/2729b5b8-4b4f-450f-870d-ea87961de95e','2025-12-08 13:54:15','sample1.pdf','1-1','Completed'),(11,'5f3fede4-38ae-4399-bd7b-7de32dc5522a','/api/analyzeResults/fe6ade6c-ce87-4cf8-ae77-e884ba54361e','2025-12-08 13:59:58','sample1.pdf','1-1','Completed'),(12,'5f3fede4-38ae-4399-bd7b-7de32dc5522a','/api/analyzeResults/37cb864d-b17c-4fd1-9a95-32e354b418d7','2025-12-08 15:41:27','sample1.pdf','1-1','Completed'),(13,'5f3fede4-38ae-4399-bd7b-7de32dc5522a','/api/analyzeResults/ba6bbb6a-6e39-4122-91d3-da6fc86cde84','2025-12-08 16:10:58','REL1 U1.pdf','1-10','Completed');
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-10 16:54:18
