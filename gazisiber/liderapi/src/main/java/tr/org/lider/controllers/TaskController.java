package tr.org.lider.controllers;

import java.io.UnsupportedEncodingException;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import tr.org.lider.services.TaskService;
import tr.org.lider.utils.IRestResponse;


/**
 *  Task execute
 * @author M. Edip YILDIZ
 *
 */

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/lider/task")
@Tag(name = "Task", description = "Task Rest Service")
public class TaskController {
	Logger logger = LoggerFactory.getLogger(TaskController.class);
	
	@Autowired
	public TaskService taskService;
	
	@Operation(summary = "Execute tasks ", description = "", tags = { "task" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Task executed. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not execute tasks. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/execute")
	public ResponseEntity<IRestResponse> executeTask(@RequestBody PluginTask requestBody, HttpServletRequest request)
			throws UnsupportedEncodingException {
		
		logger.info("Request received. URL: '/lider/task/execute' Body: {}", requestBody);
		IRestResponse restResponse = taskService.execute(requestBody);
		logger.debug("Completed processing request, returning result: {}", restResponse.toJson());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(restResponse);
				
	}
	
}
