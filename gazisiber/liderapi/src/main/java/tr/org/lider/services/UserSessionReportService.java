package tr.org.lider.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import tr.org.lider.dto.UserSessionDTO;
import tr.org.lider.entities.SessionEvent;
import tr.org.lider.repositories.UserSessionRepository;
import tr.org.lider.utils.IUserSessionReport;

@Service
public class UserSessionReportService {
	
	@Autowired
	private UserSessionRepository  userSessionRepository;

	public Long count() {
		return userSessionRepository.count();
	}
	
	public Page<IUserSessionReport> getUserSessionByFilter(UserSessionDTO userSessionDTO) {
		PageRequest pageable = PageRequest.of(userSessionDTO.getPageNumber() - 1, userSessionDTO.getPageSize(), Sort.by("createDate").descending());
		Page<IUserSessionReport> results  = null;
		int sessionTypeId = 0;
		if (userSessionDTO.getSessionType().equals("LOGIN")) {
			sessionTypeId = SessionEvent.LOGIN.getId();
		} else if (userSessionDTO.getSessionType().equals("LOGOUT")) {
			sessionTypeId = SessionEvent.LOGOUT.getId();
		}
		results = userSessionRepository.findUserSession(
				sessionTypeId,
				userSessionDTO.getUsername(),
				userSessionDTO.getHostname(),
				userSessionDTO.getStartDate(), 
				userSessionDTO.getEndDate(), 
				pageable
			);
		return results;
	}

}
