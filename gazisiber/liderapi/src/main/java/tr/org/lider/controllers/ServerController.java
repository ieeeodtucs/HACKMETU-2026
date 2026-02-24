package tr.org.lider.controllers;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.constant.LiderConstants;
import tr.org.lider.entities.OperationType;
import tr.org.lider.entities.RegistrationTemplateImpl;
import tr.org.lider.entities.ServerImpl;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;
import tr.org.lider.services.OperationLogService;
import tr.org.lider.services.RemoteSshService;
import tr.org.lider.services.ServerService;

@RestController
@RequestMapping("/api/server")
@Tag(name = "Server", description = "Server Rest Service")
public class ServerController {
	
	private final Logger logger = org.slf4j.LoggerFactory.getLogger(this.getClass());

	@Autowired
	private ServerService serverService;
	
	@Autowired
	private RemoteSshService sshService;
	
	@Autowired
	private OperationLogService operationLogService;

	@Autowired
	private NotificationDispatchService notificationDispatchService;
	
	@Operation()
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Added server. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not add server. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))),
			  @ApiResponse(responseCode = "426", description = "Could not osquery packet", 
			    content = @Content(schema = @Schema(implementation = String.class)))})	
	@PostMapping(value = "/add", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<ServerImpl> serverAdd(@RequestBody ServerImpl server) throws Exception{
		sshService.setHost(server.getIp());
		sshService.setUser(server.getUser());
		sshService.setPassword(server.getPassword());
		HttpHeaders headers = new HttpHeaders();
		
		String log =  "Server with IP "+ server.getIp() + " has been added";
		operationLogService.saveOperationLog(OperationType.CREATE, log,null,null,null,null);
		notificationDispatchService.dispatch("system.server.created",
				"Sunucu Eklendi: " + server.getIp(),
				new NotificationBodyBuilder()
					.field("Sunucu IP", server.getIp())
					.build());
			
			if(serverService.isServerReachable(server.getIp(), server.getPassword(), server.getUser())== true) {
				server.setStatus(true);
	            //serverService.add(server);
	            String result = sshService.executeCommand(LiderConstants.ServerInformation.OSQUERY_QUERY);
	            if(!result.contains("disk_total")) {
	            	
	            	return ResponseEntity
							.status(HttpStatus.OK)
							.body(serverService.add(server));
	            }
	            else {
	            	String[] passwordSplit = result.split("\\[");
	            	result = "[" + passwordSplit[passwordSplit.length-1];
					return ResponseEntity
							.status(HttpStatus.OK)
							.body(serverService.save(result,server));	
				
	            }
			}
			else if(serverService.isServerReachable(server.getIp(), server.getPassword(), server.getUser())== false) {
				server.setStatus(false);
				return ResponseEntity
						.status(HttpStatus.NOT_FOUND)
						.body(serverService.add(server));
			}
		
			return ResponseEntity
			   	.status(HttpStatus.OK)
				.body(serverService.add(server));
	}
	
	
	@Operation(summary = "Check server connection", description = "", tags = { "connection" })
    @ApiResponses(value = { 
              @ApiResponse(responseCode = "200", description = "Server is available"),
              @ApiResponse(responseCode = "500", description = "Can not reach server. Unexpected error occurred", 
                content = @Content(schema = @Schema(implementation = String.class))) })
    @PostMapping(value = "/check-connection")
    public ResponseEntity<Boolean> isServerReachable(
    		@RequestParam (value = "hostname", required = true) String hostname,
            @RequestParam (value = "password", required = true) String password,
            @RequestParam (value = "username", required = true) String username) {

        try {
        JSch jsch = new JSch();

        Session session = jsch.getSession(username, hostname, LiderConstants.ServerInformation.SSH_PORT);
        session.setPassword(password);
        session.setTimeout(1000);
        session.setConfig("StrictHostKeyChecking", "no");
        session.connect();
        session.disconnect();
        return ResponseEntity
              .status(HttpStatus.OK)
              .body(true); // Connection successful
        } catch (Exception e) {
            return ResponseEntity
                  .status(HttpStatus.INTERNAL_SERVER_ERROR)
                  .body(false);
        }
	}
	
	
	@Operation(summary = "Server List", description = "", tags = { "" })
    @ApiResponses(value = { 
              @ApiResponse(responseCode = "200", description = "Retrieved  server list"),
              @ApiResponse(responseCode = "417", description = "Can not get server list. Unexpected error occurred", 
                content = @Content(schema = @Schema(implementation = String.class))) })
    @GetMapping(value = "/list")
    public  ResponseEntity<List<ServerImpl>> getServerList() throws Throwable {
		
		HttpHeaders headers = new HttpHeaders();
		List<ServerImpl> serverList = serverService.serverList();
		
		for (ServerImpl server : serverList) {
	        server.setPassword(null);
	    }
		try {
			return ResponseEntity
				.status(HttpStatus.OK)
				.body(serverList);
		}
		catch (Exception e) {
	
			return ResponseEntity
				.status(HttpStatus.EXPECTATION_FAILED)
				.headers(headers)
				.build();
			
		}
	}

	@Operation(summary = "Server delete", description = "", tags = {""})
	@ApiResponses(value= {
			 @ApiResponse(responseCode = "200", description = "" ),
			 @ApiResponse(responseCode = "417", description = "",
			 content = @Content(schema = @Schema(implementation = String.class)))
	 })
	@DeleteMapping(value = "/delete/id/{id}")
	public ResponseEntity<ServerImpl> deleteServer(@PathVariable Long id){
				 
		try {
			if(!serverService.findServerByID(id).isPresent()) {
				logger.error("Server to delete {} but id not found!", id);
	        	HttpHeaders headers = new HttpHeaders();
	        	headers.add("message", "Server id not found !");
	    		return ResponseEntity
	    				.status(HttpStatus.NOT_FOUND)
	    				.headers(headers)
	    				.build();
			}
			Optional<ServerImpl> deletedServer = serverService.findServerByID(id);
			String log =  "Server with IP "+ deletedServer.get().getIp() + " was deleted";
			operationLogService.saveOperationLog(OperationType.DELETE, log,null,null,null,null);
			notificationDispatchService.dispatch("system.server.deleted",
					"Sunucu Silindi: " + deletedServer.get().getIp(),
					new NotificationBodyBuilder()
						.field("Sunucu IP", deletedServer.get().getIp())
						.build());
			serverService.delete(id);
					
		} 
		catch (DataAccessException e) {
			logger.error("Error delete server: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(null);
	}
	
	@Operation(summary = "Server detail List", description = "", tags = { "" })
    @ApiResponses(value = { 
              @ApiResponse(responseCode = "200", description = ""),
              @ApiResponse(responseCode = "417", description = "Unexpected error occurred", 
                content = @Content(schema = @Schema(implementation = String.class))) })
    @PostMapping(value = "/detail/id/{id}")
    public  ResponseEntity<ServerImpl> getServerDetailList(@PathVariable Long serverId) {
		logger.debug("Server id:  {} ", serverId);
		

		Optional<ServerImpl> serverDetailList = serverService.findServerByID(serverId);
		HttpHeaders headers = new HttpHeaders();
		if(serverDetailList.isPresent()) {
			return new ResponseEntity<ServerImpl>(serverDetailList.get(), HttpStatus.OK);
		}
		else {
			return ResponseEntity
    				.status(HttpStatus.NOT_FOUND)
    				.headers(headers)
    				.build();
		}
	}
	
	@Operation(summary = "Update server ", description = "", tags = { "" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "", 
			    content = { @Content(schema = @Schema(implementation = RegistrationTemplateImpl.class)) }),
			  @ApiResponse(responseCode = "417", description = "server id not found !", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<ServerImpl> updateServer(@RequestBody ServerImpl server) throws Exception {
		try {
			String log =  "Server with IP "+ server.getIp() + " has been updated";
			operationLogService.saveOperationLog(OperationType.CREATE, log,null,null,null,null);
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(serverService.update(server));
		} 
		catch (DataAccessException e) {
			logger.error("Error updated server: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}		
	
	}
	
	@Operation(summary = "Get server data", description = "", tags = { "" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "", 
			    content = { @Content(schema = @Schema(implementation = RegistrationTemplateImpl.class)) }),
			  @ApiResponse(responseCode = "417", description = "server id not found !", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/get-data", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<ServerImpl>> getServerData() {
		try {
			List<ServerImpl> serverList = serverService.findServerAll();
			for (ServerImpl server : serverList) {
		        server.setPassword(null);
		    }
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(serverList);
		} 
		catch (DataAccessException e) {
			logger.error("Error updated server: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}		
	}
	
}	
