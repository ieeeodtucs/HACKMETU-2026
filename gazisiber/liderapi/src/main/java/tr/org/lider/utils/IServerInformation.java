package tr.org.lider.utils;

import java.util.Map;


@FunctionalInterface
public interface IServerInformation {
	
	public Map<String, Object> applyServer(Map<String, Object> prop, String result);

}