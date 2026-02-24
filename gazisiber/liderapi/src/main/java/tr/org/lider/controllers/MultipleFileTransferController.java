package tr.org.lider.controllers;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.xml.bind.DatatypeConverter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.PluginTask;
import tr.org.lider.models.ConfigParams;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.TaskService;
import tr.org.lider.utils.FileCopyUtils;
import tr.org.lider.utils.IRestResponse;

/**
 *  Task execute for file transfer. This controller encoded data convert to string and send to file server
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/file-transfer/task")
@Tag(name="File Transfer Task",description="File Transfer Rest Service")
public class MultipleFileTransferController {
	Logger logger = LoggerFactory.getLogger(MultipleFileTransferController.class);
	
	@Autowired
	public TaskService taskService;
	
	@Autowired
	ConfigurationService configurationService;
	
	@Operation(summary = "Gets running files during file transfer ", description = "", tags = { "file-transfer" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417",description = "Could not get execute tasks.Unexpected error occured",
		  		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value="/execute")
	public ResponseEntity<IRestResponse> executeTask(@RequestBody PluginTask requestBody, HttpServletRequest request)
			throws UnsupportedEncodingException {
		
		Map<String, Object> parameterMap = requestBody.getParameterMap();
		String encodedFile = (String) parameterMap.get("encodedFile");
		byte[] fileAsByteArr = DatatypeConverter.parseBase64Binary(encodedFile);
		
		// Send file to file server
		logger.info("Sending file to file server");
		
		String absPathOfRemoteFile = null;
		
		ConfigParams params = configurationService.getConfigParams();
		
		try {
			absPathOfRemoteFile = new FileCopyUtils().sendFile(
					params.getFileServerHost(), 
					params.getFileServerPort(),
					params.getFileServerUsername(), 
					params.getFileServerPassword(),
					fileAsByteArr, 
					params.getFileServerAgentFilePath().replace("{0}", "lider"));
		} catch (IOException | InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
		
		logger.info("Putting remote path and removing encoded file at parameter map");
		parameterMap.put("remotePath", absPathOfRemoteFile);
		parameterMap.remove("encodedFile");
		
		logger.info("Request received. URL: '/lider/task/execute' Body: {}", requestBody);
		
		IRestResponse restResponse = taskService.execute(requestBody);
		logger.debug("Completed processing request, returning result: {}", restResponse.toJson());
		
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(restResponse);
				
	}
}
