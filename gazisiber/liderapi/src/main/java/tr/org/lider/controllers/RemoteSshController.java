package tr.org.lider.controllers;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.jcraft.jsch.Session;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.services.RemoteSshService;

/**
 * 
 * execute remote bashscripts on devices given IP
 * @author M. Edip YILDIZ
 *
 */
@RestController
@RequestMapping("/api/remote-ssh")
@Tag(name = "", description = "" )
public class RemoteSshController {
	
	private Integer SSH_CON_OK= 1;
	private Integer SSH_CON_FAIL= 0;
	
	@Autowired
	private RemoteSshService sshService;
	
	Logger logger = LoggerFactory.getLogger(RemoteSshService.class);
	
	//@RequestMapping(method=RequestMethod.POST ,value = "/executeSshCommand")
	@Operation(summary = "", description = "", tags = { "" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417", description = "", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/execute-ssh-command", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> executeSshCommand(
				@RequestParam(value="host") String host, 
				@RequestParam(value="username") String user,	
				@RequestParam(value="password") String password,
				@RequestParam(value="command") String command
				) {
			logger.info("Remote Ssh Connection to host {} user {} command {}", host, user, command);
	    	sshService.setHost(host);
	    	sshService.setUser(user);
	    	sshService.setPassword(password);
	    	
	    	try {
				 String result =sshService.executeCommand(command);
				 String[] passwordSplit = result.split("\\[");
				 result = "[" + passwordSplit[passwordSplit.length-1];
				System.out.println("resultsshhservice");
				 return ResponseEntity
						 .status(HttpStatus.OK)
						 .body(result);

			} catch (Exception e) {
				e.printStackTrace();
				HttpHeaders headers = new HttpHeaders();
	    		return ResponseEntity
	    				.status(HttpStatus.EXPECTATION_FAILED)
	    				.headers(headers)
	    				.build();
			}
	}
	//@RequestMapping(method=RequestMethod.POST ,value = "/checkSSHConnection")
	@Operation(summary = "", description = "", tags = { "" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417", description = "", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/check-ssh-connection")
	public ResponseEntity<Integer> checkSSHConnection(
			@RequestParam(value="host") String host, 
			@RequestParam(value="username") String user,	
			@RequestParam(value="password") String password
			) 
		{
		logger.info("Check Remote Ssh Connection to host {} user {} command {}", host, user);
		sshService.setHost(host);
		sshService.setUser(user);
		sshService.setPassword(password);
		try {
			Session session =sshService.getSession();
			if(session !=null) {
				return ResponseEntity
						.status(HttpStatus.OK)
						.body(SSH_CON_OK);
						
			}
			else {
				return ResponseEntity
						.status(HttpStatus.EXPECTATION_FAILED)
						.body(SSH_CON_FAIL);
			}
			
		} catch (Exception e) {
			e.printStackTrace();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(SSH_CON_FAIL);
		}
	}
}
