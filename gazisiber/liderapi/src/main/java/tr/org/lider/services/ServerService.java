package tr.org.lider.services;


import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.commons.lang3.StringUtils;
import org.bouncycastle.crypto.BlockCipher;
import org.bouncycastle.crypto.BufferedBlockCipher;
import org.bouncycastle.crypto.engines.TwofishEngine;
import org.bouncycastle.crypto.modes.CFBBlockCipher;
import org.bouncycastle.crypto.params.KeyParameter;
import org.bouncycastle.crypto.params.ParametersWithIV;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;

import tr.org.lider.constant.LiderConstants;
import tr.org.lider.entities.ServerImpl;
import tr.org.lider.entities.ServerInformationImpl;
import tr.org.lider.repositories.ServerRepository;
import tr.org.lider.utils.IServerInformationProcessor;


@Service
public class ServerService{
	
	@Autowired
	private ServerRepository serverRepository;
	
	@Autowired
	private RemoteSshService sshService;	
	
	@Value("${jwt.secret}")
	private String jwtSecret;
	
	public ServerImpl add(ServerImpl server) throws Exception {
			
		ServerImpl savedServer = new ServerImpl();
		savedServer.setIp(server.getIp());
		savedServer.setMachineName(server.getMachineName());
		savedServer.setDescription(server.getDescription());
		savedServer.setUser(server.getUser());
		savedServer.setStatus(server.getStatus());
		savedServer.setPassword(encryptAES(server.getPassword()));
		return serverRepository.save(savedServer);
	}
	
	public ServerImpl save(ServerImpl server) throws Exception {

		return serverRepository.save(server);
	}
	
	public ServerImpl save(String result, ServerImpl server) throws Exception {
	    
		if(!result.isEmpty()) {
	
			ObjectMapper mapper = new ObjectMapper();
			
			List<Map<String, Object>> listOfMaps = mapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("computer_name").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "computer_name", nameMap.get("computer_name").toString()));
			});
			
		
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("mac_addr").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "mac_addr", nameMap.get("mac_addr").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("os_name").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "os_name", nameMap.get("os_name").toString()));
			});
		
		
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("os_version").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "os_version", nameMap.get("os_version").toString()));
	
				
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("disk_total").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "disk_total", nameMap.get("disk_total").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("machine_disk").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "machine_disk", nameMap.get("machine_disk").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("memory_free").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "memory_free", nameMap.get("memory_free").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("memory_total").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "memory_total", nameMap.get("memory_total").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("physical_memory").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "physical_memory", nameMap.get("physical_memory").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("total_disk_empty").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "total_disk_empty", nameMap.get("total_disk_empty").toString()));
			});
		
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("uptime_days").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "uptime_days", nameMap.get("uptime_days").toString()));
	
				
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("uptime_hours").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "uptime_hours", nameMap.get("uptime_hours").toString()));				
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("uptime_minutes").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "uptime_minutes", nameMap.get("uptime_minutes").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("cpu_user").toString())))
			.forEach(nameMap -> {
				
				server.addProperty(new ServerInformationImpl(server, "cpu_user", nameMap.get("cpu_user").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("cpu_system").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "cpu_system", nameMap.get("cpu_system").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("cpu_idle").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "cpu_idle", nameMap.get("cpu_idle").toString()));
			});
			
			listOfMaps.stream()
			.filter(nameMap -> !(StringUtils.isEmpty(nameMap.get("cpu_core").toString())))
			.forEach(nameMap -> {
				server.addProperty(new ServerInformationImpl(server, "cpu_core", nameMap.get("cpu_core").toString()));
			});
				
			server.setStatus(true);
			server.setPassword(encryptAES(server.getPassword()));
		}
		else {
			server.setStatus(false);
			server.setIp(server.getIp());
			server.setMachineName(server.getMachineName());
			server.setDescription(server.getDescription());
			server.setUser(server.getUser());
			server.setStatus(server.getStatus());
			server.setPassword(encryptAES(server.getPassword()));
		}
		
		return serverRepository.save(server);
		
	}
	
	public ServerImpl update(ServerImpl server) throws Exception {
		ServerImpl existServer = findServerID(server.getId());
		if(isServerReachable(existServer.getIp(), decryptAES(existServer.getPassword()), existServer.getUser())== true) {
			existServer.setModifyDate(new Date());
			existServer.setMachineName(server.getMachineName());
			existServer.setIp(server.getIp());
			existServer.setUser(server.getUser());
			existServer.setPassword(encryptAES(server.getPassword()));
			existServer.setStatus(true);
			existServer.setDescription(server.getDescription());
		}
		else {
			existServer.setModifyDate(new Date());
			existServer.setMachineName(server.getMachineName());
			existServer.setIp(server.getIp());
			existServer.setUser(server.getUser());
			existServer.setPassword(encryptAES(server.getPassword()));
			existServer.setStatus(false);
			existServer.setDescription(server.getDescription());

		}
		serverRepository.save(existServer);
		ServerImpl existServer2 = findServerID(server.getId());
		existServer2.setPassword(null);
		return existServer2;
	}
	
	
	public ServerImpl findServerID(Long id) {
		return serverRepository.findOne(id);
	}
	
	public Optional<ServerImpl> findServerByID(Long serverId) {
        return serverRepository.findById(serverId);
	}
	
	public void delete(Long id) {
		serverRepository.deleteById(id);

	}
	
	public List<ServerImpl> findServerAll() {
        return serverRepository.findAll();
	}
	

	public List<ServerImpl> serverList() throws Throwable{
		
		List<ServerImpl> serverList = findServerAll();
		String updateResult;
		boolean success = false;
		int i = 0;
		for(i = 0 ; i< serverList.size(); i++) {
			ServerImpl server = serverList.get(i);
			
			sshService.setHost(serverList.get(i).getIp());
			sshService.setUser(serverList.get(i).getUser());
			sshService.setPassword(decryptAES(serverList.get(i).getPassword()));	
			
			if(isServerReachable(serverList.get(i).getIp(), decryptAES(serverList.get(i).getPassword()), serverList.get(i).getUser())== true){
				updateResult = sshService.executeCommand(LiderConstants.ServerInformation.OSQUERY_QUERY);		
				if (updateResult.contains("disk_total")) {
					String[] passwordSplit = updateResult.split("\\[");
					updateResult = "[" + passwordSplit[passwordSplit.length-1];
					ObjectMapper mapper = new ObjectMapper();
				
					List<Map<String, Object>> updateResults = mapper.readValue(updateResult, new TypeReference<List<Map<String, Object>>>() {});
					
					server = IServerInformationProcessor.applyName(
							server, 
							updateResults,
							"computer_name","mac_addr","os_name","os_version","disk_total","machine_disk","memory_free","memory_total",
							"physical_memory","total_disk_empty","uptime_days","uptime_hours","uptime_minutes","cpu_user","cpu_system","cpu_idle","cpu_core"); 
								
					success = true;
					server.setStatus(true);
					serverRepository.save(server);
				}			
			}
		else {
			server.setStatus(false);
//			serverInformationRepository.deleteInBatch(serverInformationRepository.findByServerId(server.getId()));
			System.out.println("Bu makineye ssh sağlanamadı");
			}
		}
		
		   return findServerAll();
	}
	
	 public boolean isServerReachable(String hostname, String password, String username) {

	        try {
	        JSch jsch = new JSch();

	        Session session = jsch.getSession(username, hostname, LiderConstants.ServerInformation.SSH_PORT);
	        session.setPassword(password);
	        session.setTimeout(1000);
	        session.setConfig("StrictHostKeyChecking", "no");
	        session.connect();
	        session.disconnect();
	        return true; // Connection successful
	        } catch (Exception e) {
	            return false; 
	        }
		}


	  public String encryptAES(String plainText) throws Exception {
		  
			byte[] keyBytes = jwtSecret.getBytes("UTF-8");
	        KeyParameter key = new KeyParameter(keyBytes);
	        byte[] iv = new byte[16];
	        byte[] plaintextByte = plainText.getBytes("UTF-8");
	        BlockCipher engine = new TwofishEngine();
	        BufferedBlockCipher cipher = new BufferedBlockCipher(new CFBBlockCipher(engine, 128));
	        cipher.init(true, new ParametersWithIV(key, iv));
	        byte[] outputBuffer = new byte[cipher.getOutputSize(plaintextByte.length)];
	        int bytesProcessed = cipher.processBytes(plaintextByte, 0, plaintextByte.length, outputBuffer, 0);
	        cipher.doFinal(outputBuffer, bytesProcessed);
	        return new String(Base64.getEncoder().encode(outputBuffer), "UTF-8");
	  }

	  public String decryptAES(String encryptedText) throws Exception {
		  
		    byte[] keyBytes = jwtSecret.getBytes("UTF-8");
	        KeyParameter key = new KeyParameter(keyBytes);
	        byte[] iv = new byte[16];
	        byte[] encryptedBytes = Base64.getDecoder().decode(encryptedText.getBytes("UTF-8"));
	        BlockCipher engine = new TwofishEngine();
	        BufferedBlockCipher cipher = new BufferedBlockCipher(new CFBBlockCipher(engine, 128));
	        cipher.init(false, new ParametersWithIV(key, iv));
	        byte[] outputBuffer = new byte[cipher.getOutputSize(encryptedBytes.length)];
	        int bytesProcessed = cipher.processBytes(encryptedBytes, 0, encryptedBytes.length, outputBuffer, 0);
	        cipher.doFinal(outputBuffer, bytesProcessed);
	        return new String(outputBuffer, "UTF-8");
	  }
	 
}
