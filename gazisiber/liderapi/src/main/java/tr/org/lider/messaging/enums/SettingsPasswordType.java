package tr.org.lider.messaging.enums;

public enum SettingsPasswordType {
	LDAP_PASSWORD("ldapPassword"),
	AD_ADMIN_PASSWORD("AdAdminPassword"),
	XMPP_PASSWORD("xmppPassword"),
	FILE_SERVER_PASSWORD("fileServerPassword"),
	EMAIL_SERVER_PASSWORD("emailServerPassword");
	
	private final String value;

    SettingsPasswordType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static SettingsPasswordType fromValue(String value) {
        for (SettingsPasswordType type : SettingsPasswordType.values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Invalid value: " + value);
    }
		
}
