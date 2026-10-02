package com.examdesk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ExamDeskApplication {
    public static void main(String[] args) {
        SpringApplication.run(ExamDeskApplication.class, args);
    }
}
