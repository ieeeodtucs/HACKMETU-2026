package tr.org.lider.entities;

public enum AgentStatus {
	
	Active(1), Passive(0), Suspend(2);
	
	private  int  id;
	
	private AgentStatus(int id) {
		this.id = id;
	}

	public int getId() {
		return id;
	}
	
	public static AgentStatus getType(Integer id) {
		if (id == null) {
			return null;
		}
		for (AgentStatus position : AgentStatus.values()) {
			if (id.equals(position.getId())) {
				return position;
			}
		}
		throw new IllegalArgumentException("No matching type for id: " + id);
	}
	

}
