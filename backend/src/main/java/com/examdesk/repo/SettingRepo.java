package com.examdesk.repo;

import com.examdesk.model.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SettingRepo extends JpaRepository<AppSetting, String> {
}
