package com.examdesk.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "app_settings")
@Getter @Setter @NoArgsConstructor
public class AppSetting {
    @Id @Column(name = "setting_key", length = 80)
    private String key;
    @Column(name = "setting_value", length = 2000)
    private String value;

    public AppSetting(String key, String value) { this.key = key; this.value = value; }
}
