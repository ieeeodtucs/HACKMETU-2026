package tr.org.lider.models;

import java.io.Serializable;

import tr.org.lider.entities.CommandExecutionImpl;
import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.PolicyImpl;

public class PolicyResponse  implements Serializable{

	private static final long serialVersionUID = 7776754912927612900L;
	
	private PolicyImpl policyImpl;
	private CommandImpl commandImpl;
	private CommandExecutionImpl commandExecutionImpl;
	
	public PolicyImpl getPolicyImpl() {
		return policyImpl;
	}
	
	public void setPolicyImpl(PolicyImpl policyImpl) {
		this.policyImpl = policyImpl;
	}
	
	public CommandImpl getCommandImpl() {
		return commandImpl;
	}
	
	public void setCommandImpl(CommandImpl commandImpl) {
		this.commandImpl = commandImpl;
	}
	
	public CommandExecutionImpl getCommandExecutionImpl() {
		return commandExecutionImpl;
	}
	
	public void setCommandExecutionImpl(CommandExecutionImpl commandExecutionImpl) {
		this.commandExecutionImpl = commandExecutionImpl;
	}

}
