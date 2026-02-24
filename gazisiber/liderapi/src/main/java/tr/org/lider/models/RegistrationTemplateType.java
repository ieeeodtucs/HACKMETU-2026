package tr.org.lider.models;

public enum RegistrationTemplateType {
	DEFAULT(1), HOSTNAME(2), IP_ADDRESS(3);

	private int id;

	private RegistrationTemplateType(int id) {
		this.id = id;
	}

	public int getId() {
		return id;
	}

	/**
	 * Provide mapping enums with a fixed ID in JPA (a more robust alternative
	 * to EnumType.String and EnumType.Ordinal)
	 * 
	 * @param id
	 * @return related LiderMessageType enum
	 * @see http://blog.chris-ritchie.com/2013/09/mapping-enums-with-fixed-id-in
	 *      -jpa.html
	 * 
	 */
	public static RegistrationTemplateType getType(Integer id) {
		if (id == null) {
			return null;
		}
		for (RegistrationTemplateType value : RegistrationTemplateType.values()) {
			if (id.equals(value.getId())) {
				return value;
			}
		}
		throw new IllegalArgumentException("No matching type for id: " + id);
	}
}
