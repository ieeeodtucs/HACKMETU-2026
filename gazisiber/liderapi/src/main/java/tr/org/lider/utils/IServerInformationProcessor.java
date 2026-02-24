package tr.org.lider.utils;

import java.util.Date;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;

import tr.org.lider.entities.ServerImpl;
import tr.org.lider.entities.ServerInformationImpl;


public interface IServerInformationProcessor {
	
	public static ServerImpl applyName(ServerImpl server, List<Map<String, Object>> list, String... propNames) {
		
		for (String propName : propNames) {
			list.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get(propName).toString())))
			.forEach(nameMap -> {
				for(ServerInformationImpl prop : server.getProperties()) {
					prop.applyServer(nameMap, propName);
					prop.setModifyDate(new Date());
				}
		
			});		
		}
		return server;
	}
}
